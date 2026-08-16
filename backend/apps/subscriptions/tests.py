from datetime import timedelta
from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.users.models import User

from . import payment, services
from .models import SubscriptionPlan, Transaction, UserSubscription


class FakeProvider:
    """Test-only provider: deterministic success/failure, injected directly
    into payment.verify_transaction() so tests don't need to reach into a
    real (or the development-mock) provider's internals."""

    def __init__(self, success):
        self._success = success

    def initiate(self, txn):
        return payment.PaymentInitiationResult(reference_id='FAKE-REF', provider='fake-test', mock=True)

    def verify(self, txn):
        return payment.PaymentVerificationResult(success=self._success)


def make_user(suffix, role=User.Role.LISTENER):
    return User.objects.create(
        email=f'{suffix}@example.com',
        display_name=suffix,
        username=suffix,
        role=role,
    )


class PlanMixin:
    def setUp(self):
        self.basic = SubscriptionPlan.objects.get(tier=SubscriptionPlan.Tier.BASIC)
        self.silver = SubscriptionPlan.objects.get(tier=SubscriptionPlan.Tier.SILVER)
        self.gold = SubscriptionPlan.objects.get(tier=SubscriptionPlan.Tier.GOLD)
        self.today = timezone.localdate()


class EffectiveSubscriptionTests(PlanMixin, TestCase):
    def test_no_paid_subscription_falls_back_to_basic(self):
        user = make_user('eff_none')
        self.assertIsNone(services.get_effective_subscription(user))
        self.assertEqual(services.get_effective_plan(user).tier, SubscriptionPlan.Tier.BASIC)

    def test_valid_current_subscription_is_effective(self):
        user = make_user('eff_current')
        UserSubscription.objects.create(
            user=user,
            plan=self.silver,
            start_date=self.today - timedelta(days=5),
            end_date=self.today + timedelta(days=25),
            status=UserSubscription.Status.ACTIVE,
        )
        self.assertEqual(services.get_effective_plan(user).tier, SubscriptionPlan.Tier.SILVER)

    def test_expired_subscription_not_effective_and_marked_expired(self):
        user = make_user('eff_expired')
        sub = UserSubscription.objects.create(
            user=user,
            plan=self.silver,
            start_date=self.today - timedelta(days=40),
            end_date=self.today - timedelta(days=10),
            status=UserSubscription.Status.ACTIVE,
        )
        self.assertEqual(services.get_effective_plan(user).tier, SubscriptionPlan.Tier.BASIC)
        sub.refresh_from_db()
        self.assertEqual(sub.status, UserSubscription.Status.EXPIRED)

    def test_future_subscription_not_effective_and_does_not_sync_yet(self):
        user = make_user('eff_future')
        UserSubscription.objects.create(
            user=user,
            plan=self.gold,
            start_date=self.today + timedelta(days=10),
            end_date=self.today + timedelta(days=40),
            status=UserSubscription.Status.ACTIVE,
        )
        self.assertIsNone(services.get_effective_subscription(user))
        self.assertEqual(services.get_effective_plan(user).tier, SubscriptionPlan.Tier.BASIC)

        services.sync_user_subscription_tier(user)
        user.refresh_from_db()
        self.assertEqual(user.subscription, User.Subscription.BASIC)


class ActivationTests(PlanMixin, TestCase):
    def test_activation_with_no_previous_subscription_starts_now(self):
        user = make_user('act_new')
        sub = services.activate_subscription(user, self.silver, 1)
        self.assertEqual(sub.start_date, self.today)

    def test_renewal_before_expiration_starts_exactly_at_previous_end_date(self):
        user = make_user('act_renew')
        first = services.activate_subscription(user, self.silver, 1)
        second = services.activate_subscription(user, self.silver, 1)
        self.assertEqual(second.start_date, first.end_date)

    def test_multiple_scheduled_subscriptions_start_after_latest_end(self):
        user = make_user('act_multi')
        first = services.activate_subscription(user, self.silver, 1)
        second = services.activate_subscription(user, self.gold, 1)
        third = services.activate_subscription(user, self.silver, 1)
        self.assertEqual(second.start_date, first.end_date)
        self.assertEqual(third.start_date, second.end_date)

    def test_no_overlap_between_generated_periods(self):
        user = make_user('act_overlap')
        subs = [services.activate_subscription(user, self.silver, 1) for _ in range(3)]
        subs.sort(key=lambda s: s.start_date)
        for earlier, later in zip(subs, subs[1:]):
            self.assertLessEqual(earlier.end_date, later.start_date)

    def test_plan_change_starts_after_existing_scheduled_period(self):
        user = make_user('act_change')
        silver_sub = services.activate_subscription(user, self.silver, 1)
        gold_sub = services.activate_subscription(user, self.gold, 3)
        self.assertEqual(gold_sub.start_date, silver_sub.end_date)
        self.assertEqual(gold_sub.plan.tier, SubscriptionPlan.Tier.GOLD)

    def test_all_valid_durations_use_real_calendar_months(self):
        for months in (1, 3, 6, 12):
            with self.subTest(months=months):
                user = make_user(f'act_dur_{months}')
                sub = services.activate_subscription(user, self.silver, months)
                month_index = sub.start_date.month - 1 + months
                expected_year = sub.start_date.year + month_index // 12
                expected_month = month_index % 12 + 1
                self.assertEqual(sub.end_date.year, expected_year)
                self.assertEqual(sub.end_date.month, expected_month)
                self.assertEqual(sub.end_date.day, sub.start_date.day)

    def test_invalid_duration_raises_validation_error(self):
        user = make_user('act_invalid')
        with self.assertRaises(ValidationError):
            services.activate_subscription(user, self.silver, 2)


class UserSubscriptionSyncTests(PlanMixin, TestCase):
    def test_sync_sets_silver_and_gold_tiers(self):
        for plan, expected in (
            (self.silver, User.Subscription.SILVER),
            (self.gold, User.Subscription.GOLD),
        ):
            user = make_user(f'sync_{plan.tier}')
            services.activate_subscription(user, plan, 1)
            user.refresh_from_db()
            self.assertEqual(user.subscription, expected)

    def test_basic_fallback_sync_with_no_subscription(self):
        user = make_user('sync_basic')
        services.sync_user_subscription_tier(user)
        user.refresh_from_db()
        self.assertEqual(user.subscription, User.Subscription.BASIC)

    def test_basic_fallback_sync_after_expiration(self):
        user = make_user('sync_expired')
        UserSubscription.objects.create(
            user=user,
            plan=self.silver,
            start_date=self.today - timedelta(days=40),
            end_date=self.today - timedelta(days=10),
            status=UserSubscription.Status.ACTIVE,
        )
        services.sync_user_subscription_tier(user)
        user.refresh_from_db()
        self.assertEqual(user.subscription, User.Subscription.BASIC)


class SubscriptionPlanListAPITests(PlanMixin, APITestCase):
    def test_list_returns_plans_in_basic_silver_gold_order(self):
        response = self.client.get(reverse('subscription-plans'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        tiers = [item['tier'] for item in response.data]
        self.assertEqual(tiers, ['basic', 'silver', 'gold'])

    def test_inactive_plan_is_excluded(self):
        self.gold.is_active = False
        self.gold.save(update_fields=['is_active'])
        response = self.client.get(reverse('subscription-plans'))
        tiers = [item['tier'] for item in response.data]
        self.assertEqual(tiers, ['basic', 'silver'])

    def test_plan_payload_preserves_none_as_unlimited(self):
        response = self.client.get(reverse('subscription-plans'))
        gold = next(item for item in response.data if item['tier'] == 'gold')
        basic = next(item for item in response.data if item['tier'] == 'basic')
        self.assertIsNone(gold['dailyStreamLimit'])
        self.assertIsNone(gold['playlistLimit'])
        self.assertEqual(basic['dailyStreamLimit'], 60)
        self.assertEqual(basic['playlistLimit'], 6)


class CurrentSubscriptionAPITests(PlanMixin, APITestCase):
    def test_missing_user_id_returns_400(self):
        response = self.client.get(reverse('subscription-current'))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_non_numeric_user_id_returns_400(self):
        response = self.client.get(reverse('subscription-current'), {'userId': 'abc'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_nonexistent_user_id_returns_404(self):
        response = self.client.get(reverse('subscription-current'), {'userId': 999999})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_with_no_paid_subscription_returns_basic(self):
        user = make_user('cur_basic')
        response = self.client.get(reverse('subscription-current'), {'userId': user.id})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['tier'], 'basic')
        self.assertIsNone(response.data['startDate'])
        self.assertIsNone(response.data['status'])

    def test_user_with_current_silver_subscription(self):
        user = make_user('cur_silver')
        sub = UserSubscription.objects.create(
            user=user,
            plan=self.silver,
            start_date=self.today - timedelta(days=1),
            end_date=self.today + timedelta(days=29),
            status=UserSubscription.Status.ACTIVE,
        )
        response = self.client.get(reverse('subscription-current'), {'userId': user.id})
        self.assertEqual(response.data['tier'], 'silver')
        self.assertEqual(response.data['status'], 'active')
        self.assertEqual(str(response.data['startDate']), str(sub.start_date))

    def test_user_with_current_gold_subscription(self):
        user = make_user('cur_gold')
        services.activate_subscription(user, self.gold, 1)
        response = self.client.get(reverse('subscription-current'), {'userId': user.id})
        self.assertEqual(response.data['tier'], 'gold')

    def test_expired_subscription_not_returned_as_current(self):
        user = make_user('cur_expired')
        UserSubscription.objects.create(
            user=user,
            plan=self.silver,
            start_date=self.today - timedelta(days=40),
            end_date=self.today - timedelta(days=10),
            status=UserSubscription.Status.ACTIVE,
        )
        response = self.client.get(reverse('subscription-current'), {'userId': user.id})
        self.assertEqual(response.data['tier'], 'basic')
        self.assertIsNone(response.data['status'])

    def test_future_subscription_not_returned_as_current(self):
        user = make_user('cur_future')
        UserSubscription.objects.create(
            user=user,
            plan=self.gold,
            start_date=self.today + timedelta(days=10),
            end_date=self.today + timedelta(days=40),
            status=UserSubscription.Status.ACTIVE,
        )
        response = self.client.get(reverse('subscription-current'), {'userId': user.id})
        self.assertEqual(response.data['tier'], 'basic')

    def test_current_endpoint_syncs_user_subscription_field(self):
        user = make_user('cur_sync')
        services.activate_subscription(user, self.gold, 1)
        User.objects.filter(pk=user.pk).update(subscription=User.Subscription.BASIC)
        self.client.get(reverse('subscription-current'), {'userId': user.id})
        user.refresh_from_db()
        self.assertEqual(user.subscription, User.Subscription.GOLD)

    def test_current_endpoint_has_no_write_side_effects_on_history(self):
        user = make_user('cur_noside')
        self.client.get(reverse('subscription-current'), {'userId': user.id})
        self.assertEqual(UserSubscription.objects.filter(user=user).count(), 0)
        self.assertEqual(Transaction.objects.filter(user=user).count(), 0)


class SubscriptionHistoryAPITests(PlanMixin, APITestCase):
    def test_missing_user_id_returns_400(self):
        response = self.client.get(reverse('subscription-history'))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_nonexistent_user_id_returns_404(self):
        response = self.client.get(reverse('subscription-history'), {'userId': 999999})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_history_includes_expired_current_and_future_newest_first(self):
        user = make_user('hist_all')
        expired = UserSubscription.objects.create(
            user=user,
            plan=self.silver,
            start_date=self.today - timedelta(days=40),
            end_date=self.today - timedelta(days=10),
            status=UserSubscription.Status.EXPIRED,
        )
        current = UserSubscription.objects.create(
            user=user,
            plan=self.silver,
            start_date=self.today - timedelta(days=5),
            end_date=self.today + timedelta(days=25),
            status=UserSubscription.Status.ACTIVE,
        )
        future = UserSubscription.objects.create(
            user=user,
            plan=self.gold,
            start_date=self.today + timedelta(days=25),
            end_date=self.today + timedelta(days=55),
            status=UserSubscription.Status.ACTIVE,
        )
        response = self.client.get(reverse('subscription-history'), {'userId': user.id})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = [item['id'] for item in response.data]
        self.assertEqual(returned_ids, [future.id, current.id, expired.id])

    def test_history_call_does_not_create_extra_records(self):
        user = make_user('hist_noside')
        self.client.get(reverse('subscription-history'), {'userId': user.id})
        self.assertEqual(UserSubscription.objects.filter(user=user).count(), 0)


class PurchaseAPITests(PlanMixin, APITestCase):
    def test_purchase_creates_pending_transaction_with_correct_snapshot(self):
        user = make_user('purchase_pending')
        response = self.client.post(
            reverse('subscription-purchase'),
            {'userId': user.id, 'planId': self.silver.id, 'durationMonths': 3},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        txn = Transaction.objects.get(user=user)
        self.assertEqual(txn.status, Transaction.Status.PENDING)
        self.assertEqual(txn.amount, self.silver.price_3_months)
        self.assertEqual(txn.plan_tier_snapshot, SubscriptionPlan.Tier.SILVER)
        self.assertEqual(txn.duration_months, 3)
        self.assertEqual(response.data['transaction']['transactionId'], txn.id)
        self.assertTrue(response.data['payment']['mock'])
        self.assertEqual(UserSubscription.objects.filter(user=user).count(), 0)

    def test_price_snapshot_survives_later_plan_price_change(self):
        user = make_user('purchase_snapshot')
        response = self.client.post(
            reverse('subscription-purchase'),
            {'userId': user.id, 'planId': self.gold.id, 'durationMonths': 1},
            format='json',
        )
        txn_id = response.data['transaction']['transactionId']
        original_amount = Transaction.objects.get(pk=txn_id).amount

        self.gold.price_1_month = original_amount + 999999
        self.gold.save(update_fields=['price_1_month'])

        txn = Transaction.objects.get(pk=txn_id)
        self.assertEqual(txn.amount, original_amount)

    def test_invalid_duration_creates_no_transaction(self):
        user = make_user('purchase_bad_duration')
        response = self.client.post(
            reverse('subscription-purchase'),
            {'userId': user.id, 'planId': self.silver.id, 'durationMonths': 2},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Transaction.objects.filter(user=user).count(), 0)

    def test_invalid_user_creates_no_transaction(self):
        response = self.client.post(
            reverse('subscription-purchase'),
            {'userId': 999999, 'planId': self.silver.id, 'durationMonths': 1},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(Transaction.objects.count(), 0)

    def test_invalid_plan_creates_no_transaction(self):
        user = make_user('purchase_bad_plan')
        response = self.client.post(
            reverse('subscription-purchase'),
            {'userId': user.id, 'planId': 999999, 'durationMonths': 1},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(Transaction.objects.filter(user=user).count(), 0)

    def test_inactive_plan_is_rejected(self):
        user = make_user('purchase_inactive')
        self.silver.is_active = False
        self.silver.save(update_fields=['is_active'])
        response = self.client.post(
            reverse('subscription-purchase'),
            {'userId': user.id, 'planId': self.silver.id, 'durationMonths': 1},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Transaction.objects.filter(user=user).count(), 0)

    def test_basic_purchase_is_rejected(self):
        user = make_user('purchase_basic')
        response = self.client.post(
            reverse('subscription-purchase'),
            {'userId': user.id, 'planId': self.basic.id, 'durationMonths': 1},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Transaction.objects.filter(user=user).count(), 0)
        self.assertEqual(UserSubscription.objects.filter(user=user).count(), 0)


class VerifyTransactionAPITests(PlanMixin, APITestCase):
    def _purchase(self, user, plan, months):
        response = self.client.post(
            reverse('subscription-purchase'),
            {'userId': user.id, 'planId': plan.id, 'durationMonths': months},
            format='json',
        )
        return response.data['transaction']['transactionId']

    def test_successful_verification_activates_subscription(self):
        user = make_user('verify_success')
        txn_id = self._purchase(user, self.silver, 1)

        response = self.client.post(reverse('subscription-verify'), {'transactionId': txn_id}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['transaction']['status'], Transaction.Status.SUCCESS)

        txn = Transaction.objects.get(pk=txn_id)
        self.assertEqual(txn.status, Transaction.Status.SUCCESS)
        self.assertIsNotNone(txn.verified_at)
        self.assertIsNotNone(txn.user_subscription_id)
        self.assertEqual(UserSubscription.objects.filter(user=user).count(), 1)

        user.refresh_from_db()
        self.assertEqual(user.subscription, User.Subscription.SILVER)

    def test_failed_verification_does_not_activate(self):
        user = make_user('verify_fail')
        txn_id = self._purchase(user, self.silver, 1)

        with patch('apps.subscriptions.payment.get_payment_provider', return_value=FakeProvider(success=False)):
            response = self.client.post(reverse('subscription-verify'), {'transactionId': txn_id}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        txn = Transaction.objects.get(pk=txn_id)
        self.assertEqual(txn.status, Transaction.Status.FAILED)
        self.assertIsNotNone(txn.verified_at)
        self.assertIsNone(txn.user_subscription_id)
        self.assertEqual(UserSubscription.objects.filter(user=user).count(), 0)

        user.refresh_from_db()
        self.assertEqual(user.subscription, User.Subscription.BASIC)

    def test_idempotent_double_verification_creates_one_subscription(self):
        user = make_user('verify_idempotent')
        txn_id = self._purchase(user, self.gold, 1)

        self.client.post(reverse('subscription-verify'), {'transactionId': txn_id}, format='json')
        self.client.post(reverse('subscription-verify'), {'transactionId': txn_id}, format='json')

        self.assertEqual(UserSubscription.objects.filter(user=user).count(), 1)

    def test_already_successful_transaction_returns_existing_result(self):
        user = make_user('verify_already_success')
        txn_id = self._purchase(user, self.gold, 1)

        first = self.client.post(reverse('subscription-verify'), {'transactionId': txn_id}, format='json')
        second = self.client.post(reverse('subscription-verify'), {'transactionId': txn_id}, format='json')

        self.assertEqual(
            first.data['transaction']['userSubscription']['id'],
            second.data['transaction']['userSubscription']['id'],
        )
        self.assertEqual(UserSubscription.objects.filter(user=user).count(), 1)

    def test_verify_nonexistent_transaction_returns_404(self):
        response = self.client.post(reverse('subscription-verify'), {'transactionId': 999999}, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_renewal_through_payment_schedules_after_existing_period(self):
        user = make_user('verify_renewal')
        first_txn_id = self._purchase(user, self.silver, 1)
        self.client.post(reverse('subscription-verify'), {'transactionId': first_txn_id}, format='json')
        first_sub = UserSubscription.objects.get(user=user)

        second_txn_id = self._purchase(user, self.silver, 1)
        self.client.post(reverse('subscription-verify'), {'transactionId': second_txn_id}, format='json')

        subs = list(UserSubscription.objects.filter(user=user).order_by('start_date'))
        self.assertEqual(len(subs), 2)
        self.assertEqual(subs[1].start_date, first_sub.end_date)
        self.assertLessEqual(subs[0].end_date, subs[1].start_date)

    def test_plan_change_through_payment_schedules_after_latest_period(self):
        user = make_user('verify_plan_change')
        silver_txn_id = self._purchase(user, self.silver, 1)
        self.client.post(reverse('subscription-verify'), {'transactionId': silver_txn_id}, format='json')
        silver_sub = UserSubscription.objects.get(user=user, plan=self.silver)

        gold_txn_id = self._purchase(user, self.gold, 3)
        self.client.post(reverse('subscription-verify'), {'transactionId': gold_txn_id}, format='json')
        gold_sub = UserSubscription.objects.get(user=user, plan=self.gold)

        self.assertEqual(gold_sub.start_date, silver_sub.end_date)


class VerifyTransactionAtomicityTests(PlanMixin, TestCase):
    def test_activation_failure_leaves_transaction_pending_with_no_orphan_subscription(self):
        user = make_user('verify_atomic')
        txn, _initiation = payment.create_pending_transaction(user, self.silver, 1)

        with patch('apps.subscriptions.payment.activate_subscription', side_effect=RuntimeError('boom')):
            with self.assertRaises(RuntimeError):
                payment.verify_transaction(txn.id)

        txn.refresh_from_db()
        self.assertEqual(txn.status, Transaction.Status.PENDING)
        self.assertIsNone(txn.user_subscription_id)
        self.assertEqual(UserSubscription.objects.filter(user=user).count(), 0)

        user.refresh_from_db()
        self.assertEqual(user.subscription, User.Subscription.BASIC)


class ReportsOverviewAPITests(PlanMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.admin = make_user('report_admin', role=User.Role.ADMIN)

    def _get(self, user_id=None):
        params = {'userId': self.admin.id if user_id is None else user_id}
        return self.client.get(reverse('subscription-reports-overview'), params)

    # --- access / request validation -------------------------------------

    def test_missing_user_id_returns_400(self):
        response = self.client.get(reverse('subscription-reports-overview'))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_nonexistent_user_returns_404(self):
        response = self._get(user_id=999999)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_non_admin_user_is_rejected(self):
        listener = make_user('report_listener')
        response = self._get(user_id=listener.id)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_support_staff_is_also_rejected(self):
        # Only 'admin' passes, matching StaffSubscriptionsPage's isAdmin()
        # gate exactly (isStaff() alone is not enough on that page).
        support = make_user('report_support', role=User.Role.SUPPORT)
        response = self._get(user_id=support.id)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # --- empty database ----------------------------------------------------

    def test_empty_database_reports_numeric_zero(self):
        response = self._get()
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        finance = response.data['finance']
        self.assertEqual(finance['totalRevenue'], 0)
        self.assertEqual(finance['successfulTransactionCount'], 0)
        self.assertEqual(finance['pendingTransactionCount'], 0)
        self.assertEqual(finance['failedTransactionCount'], 0)
        self.assertEqual(finance['revenueByPlan'], [])
        self.assertEqual(finance['revenueByDuration'], [])
        self.assertEqual(finance['recentTransactions'], [])

        subs = response.data['subscriptions']
        self.assertEqual(subs['totalSubscriptionRecords'], 0)
        self.assertEqual(subs['activeEffectiveSubscriptions'], 0)
        self.assertEqual(subs['futureScheduledSubscriptions'], 0)
        self.assertEqual(subs['expiredSubscriptions'], 0)
        self.assertEqual(subs['cancelledSubscriptions'], 0)
        self.assertEqual(subs['recentSubscriptions'], [])

        dist = response.data['planDistribution']
        self.assertEqual(dist['basicUsers'], 0)
        self.assertEqual(dist['silverUsers'], 0)
        self.assertEqual(dist['goldUsers'], 0)
        self.assertEqual(dist['totalUsers'], 0)

    # --- financial summary ---------------------------------------------

    def test_successful_transaction_contributes_to_revenue(self):
        user = make_user('fin_success')
        Transaction.objects.create(
            user=user,
            plan=self.silver,
            plan_tier_snapshot=self.silver.tier,
            duration_months=1,
            amount=self.silver.price_1_month,
            status=Transaction.Status.SUCCESS,
        )
        finance = self._get().data['finance']
        self.assertEqual(finance['totalRevenue'], self.silver.price_1_month)
        self.assertEqual(finance['successfulTransactionCount'], 1)

    def test_pending_transaction_does_not_contribute_to_revenue(self):
        user = make_user('fin_pending')
        Transaction.objects.create(
            user=user,
            plan=self.gold,
            plan_tier_snapshot=self.gold.tier,
            duration_months=1,
            amount=self.gold.price_1_month,
            status=Transaction.Status.PENDING,
        )
        finance = self._get().data['finance']
        self.assertEqual(finance['totalRevenue'], 0)
        self.assertEqual(finance['pendingTransactionCount'], 1)
        self.assertEqual(finance['successfulTransactionCount'], 0)

    def test_failed_transaction_does_not_contribute_to_revenue(self):
        user = make_user('fin_failed')
        Transaction.objects.create(
            user=user,
            plan=self.gold,
            plan_tier_snapshot=self.gold.tier,
            duration_months=1,
            amount=self.gold.price_1_month,
            status=Transaction.Status.FAILED,
        )
        finance = self._get().data['finance']
        self.assertEqual(finance['totalRevenue'], 0)
        self.assertEqual(finance['failedTransactionCount'], 1)
        self.assertEqual(finance['successfulTransactionCount'], 0)

    def test_revenue_uses_transaction_amount_snapshot_not_current_plan_price(self):
        user = make_user('fin_snapshot')
        Transaction.objects.create(
            user=user,
            plan=self.gold,
            plan_tier_snapshot=self.gold.tier,
            duration_months=1,
            amount=12345,
            status=Transaction.Status.SUCCESS,
        )
        self.gold.price_1_month = 999999
        self.gold.save(update_fields=['price_1_month'])

        finance = self._get().data['finance']
        self.assertEqual(finance['totalRevenue'], 12345)

    def test_revenue_by_plan_aggregation(self):
        u1, u2 = make_user('fin_plan_1'), make_user('fin_plan_2')
        Transaction.objects.create(
            user=u1, plan=self.silver, plan_tier_snapshot='silver',
            duration_months=1, amount=100, status=Transaction.Status.SUCCESS,
        )
        Transaction.objects.create(
            user=u2, plan=self.gold, plan_tier_snapshot='gold',
            duration_months=1, amount=200, status=Transaction.Status.SUCCESS,
        )
        by_plan = {row['tier']: row for row in self._get().data['finance']['revenueByPlan']}
        self.assertEqual(by_plan['silver']['revenue'], 100)
        self.assertEqual(by_plan['silver']['count'], 1)
        self.assertEqual(by_plan['gold']['revenue'], 200)
        self.assertEqual(by_plan['gold']['count'], 1)

    def test_revenue_by_duration_aggregation(self):
        user = make_user('fin_dur')
        Transaction.objects.create(
            user=user, plan=self.silver, plan_tier_snapshot='silver',
            duration_months=3, amount=300, status=Transaction.Status.SUCCESS,
        )
        Transaction.objects.create(
            user=user, plan=self.silver, plan_tier_snapshot='silver',
            duration_months=3, amount=300, status=Transaction.Status.SUCCESS,
        )
        by_duration = {
            row['durationMonths']: row for row in self._get().data['finance']['revenueByDuration']
        }
        self.assertEqual(by_duration[3]['revenue'], 600)
        self.assertEqual(by_duration[3]['count'], 2)

    def test_recent_transactions_ordering_is_deterministic(self):
        user = make_user('fin_recent')
        older = Transaction.objects.create(
            user=user, plan=self.silver, plan_tier_snapshot='silver',
            duration_months=1, amount=10, status=Transaction.Status.PENDING,
        )
        newer = Transaction.objects.create(
            user=user, plan=self.silver, plan_tier_snapshot='silver',
            duration_months=1, amount=20, status=Transaction.Status.PENDING,
        )
        ids = [item['transactionId'] for item in self._get().data['finance']['recentTransactions']]
        self.assertEqual(ids[0], newer.id)
        self.assertIn(older.id, ids)

    # --- subscription summary -------------------------------------------

    def test_effective_subscription_counted_as_active(self):
        user = make_user('sub_effective')
        UserSubscription.objects.create(
            user=user, plan=self.silver,
            start_date=self.today - timedelta(days=1),
            end_date=self.today + timedelta(days=29),
            status=UserSubscription.Status.ACTIVE,
        )
        subs = self._get().data['subscriptions']
        self.assertEqual(subs['activeEffectiveSubscriptions'], 1)
        self.assertEqual(subs['totalSubscriptionRecords'], 1)

    def test_future_subscription_not_counted_as_effective(self):
        user = make_user('sub_future')
        UserSubscription.objects.create(
            user=user, plan=self.gold,
            start_date=self.today + timedelta(days=10),
            end_date=self.today + timedelta(days=40),
            status=UserSubscription.Status.ACTIVE,
        )
        subs = self._get().data['subscriptions']
        self.assertEqual(subs['activeEffectiveSubscriptions'], 0)
        self.assertEqual(subs['expiredSubscriptions'], 0)
        self.assertEqual(subs['futureScheduledSubscriptions'], 1)

    def test_expired_subscription_not_counted_as_effective(self):
        user = make_user('sub_expired')
        UserSubscription.objects.create(
            user=user, plan=self.silver,
            start_date=self.today - timedelta(days=40),
            end_date=self.today - timedelta(days=10),
            status=UserSubscription.Status.ACTIVE,
        )
        subs = self._get().data['subscriptions']
        self.assertEqual(subs['activeEffectiveSubscriptions'], 0)
        self.assertEqual(subs['expiredSubscriptions'], 1)

    def test_expired_subscription_counted_even_if_status_not_lazily_flipped_yet(self):
        user = make_user('sub_stale')
        sub = UserSubscription.objects.create(
            user=user, plan=self.silver,
            start_date=self.today - timedelta(days=40),
            end_date=self.today - timedelta(days=10),
            status=UserSubscription.Status.ACTIVE,
        )
        subs = self._get().data['subscriptions']
        sub.refresh_from_db()
        self.assertEqual(sub.status, UserSubscription.Status.ACTIVE)  # never lazily touched
        self.assertEqual(subs['expiredSubscriptions'], 1)
        self.assertEqual(subs['activeEffectiveSubscriptions'], 0)

    def test_cancelled_subscription_counted_correctly(self):
        user = make_user('sub_cancelled')
        UserSubscription.objects.create(
            user=user, plan=self.silver,
            start_date=self.today - timedelta(days=5),
            end_date=self.today + timedelta(days=25),
            status=UserSubscription.Status.CANCELLED,
        )
        subs = self._get().data['subscriptions']
        self.assertEqual(subs['cancelledSubscriptions'], 1)
        self.assertEqual(subs['activeEffectiveSubscriptions'], 0)
        self.assertEqual(subs['expiredSubscriptions'], 0)

    def test_subscriptions_by_plan_only_counts_currently_effective(self):
        u1, u2 = make_user('sub_byplan_1'), make_user('sub_byplan_2')
        UserSubscription.objects.create(
            user=u1, plan=self.silver,
            start_date=self.today, end_date=self.today + timedelta(days=30),
            status=UserSubscription.Status.ACTIVE,
        )
        UserSubscription.objects.create(
            user=u2, plan=self.gold,
            start_date=self.today + timedelta(days=10), end_date=self.today + timedelta(days=40),
            status=UserSubscription.Status.ACTIVE,
        )
        by_plan = {
            row['tier']: row['count']
            for row in self._get().data['subscriptions']['subscriptionsByPlan']
        }
        self.assertEqual(by_plan.get('silver'), 1)
        self.assertNotIn('gold', by_plan)

    def test_recent_subscriptions_ordering_is_deterministic(self):
        user = make_user('sub_recent')
        UserSubscription.objects.create(
            user=user, plan=self.silver,
            start_date=self.today, end_date=self.today + timedelta(days=30),
            status=UserSubscription.Status.ACTIVE,
        )
        newer = UserSubscription.objects.create(
            user=user, plan=self.gold,
            start_date=self.today + timedelta(days=30), end_date=self.today + timedelta(days=60),
            status=UserSubscription.Status.ACTIVE,
        )
        ids = [item['id'] for item in self._get().data['subscriptions']['recentSubscriptions']]
        self.assertEqual(ids[0], newer.id)

    # --- plan distribution -------------------------------------------------

    def test_basic_fallback_users_counted_without_usersubscription_row(self):
        make_user('dist_basic_1')
        make_user('dist_basic_2')
        dist = self._get().data['planDistribution']
        self.assertEqual(dist['basicUsers'], 2)
        self.assertEqual(dist['silverUsers'], 0)
        self.assertEqual(dist['goldUsers'], 0)
        self.assertEqual(dist['totalUsers'], 2)

    def test_effective_silver_and_gold_users_counted_correctly(self):
        silver_user = make_user('dist_silver')
        services.activate_subscription(silver_user, self.silver, 1)
        gold_user = make_user('dist_gold')
        services.activate_subscription(gold_user, self.gold, 1)
        basic_user = make_user('dist_basic')

        dist = self._get().data['planDistribution']
        self.assertEqual(dist['silverUsers'], 1)
        self.assertEqual(dist['goldUsers'], 1)
        self.assertEqual(dist['basicUsers'], 1)
        self.assertEqual(dist['totalUsers'], 3)

    def test_expired_subscriber_falls_back_to_basic_in_distribution(self):
        user = make_user('dist_expired')
        UserSubscription.objects.create(
            user=user, plan=self.gold,
            start_date=self.today - timedelta(days=40), end_date=self.today - timedelta(days=10),
            status=UserSubscription.Status.ACTIVE,
        )
        dist = self._get().data['planDistribution']
        self.assertEqual(dist['goldUsers'], 0)
        self.assertEqual(dist['basicUsers'], 1)

    def test_future_subscriber_still_counted_as_basic_until_start_date(self):
        user = make_user('dist_future')
        UserSubscription.objects.create(
            user=user, plan=self.gold,
            start_date=self.today + timedelta(days=10), end_date=self.today + timedelta(days=40),
            status=UserSubscription.Status.ACTIVE,
        )
        dist = self._get().data['planDistribution']
        self.assertEqual(dist['goldUsers'], 0)
        self.assertEqual(dist['basicUsers'], 1)

    def test_staff_roles_excluded_from_plan_distribution(self):
        make_user('dist_listener', role=User.Role.LISTENER)
        make_user('dist_artist', role=User.Role.ARTIST)
        make_user('dist_support', role=User.Role.SUPPORT)
        make_user('dist_admin2', role=User.Role.ADMIN)

        dist = self._get().data['planDistribution']
        self.assertEqual(dist['totalUsers'], 2)

    # --- response shape -----------------------------------------------

    def test_response_contains_all_three_sections(self):
        response = self._get()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('planDistribution', response.data)
        self.assertIn('subscriptions', response.data)
        self.assertIn('finance', response.data)
