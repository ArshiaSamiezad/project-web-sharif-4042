"""
Payment provider abstraction + Transaction orchestration (Phase 5).

No real payment gateway exists in this repository or its specification:
`backend/requirements.txt` has no gateway SDK, `backend/config/settings.py`
has no gateway credentials, and the frontend's PaymentPage.jsx explicitly
labels checkout as not active yet ("Checkout and plan changes are part of
phase 2 and are not active yet"). So this module implements a clearly-named
DEVELOPMENT/MOCK provider instead of pretending a real payment happened.

A real gateway can be dropped in later by pointing get_payment_provider() at
a class exposing the same initiate(txn) / verify(txn) interface — nothing
else in the app (views, services) needs to change.
"""
from dataclasses import dataclass

from django.core.exceptions import ValidationError
from django.db import transaction as db_transaction
from django.utils import timezone

from .models import SubscriptionPlan, Transaction
from .services import ALLOWED_DURATIONS_MONTHS, activate_subscription

PRICE_FIELD_BY_DURATION = {
    1: 'price_1_month',
    3: 'price_3_months',
    6: 'price_6_months',
    12: 'price_12_months',
}


@dataclass
class PaymentInitiationResult:
    reference_id: str
    provider: str
    mock: bool


@dataclass
class PaymentVerificationResult:
    success: bool


class DevelopmentMockPaymentProvider:
    """
    NOT a real payment gateway. A deterministic development/testing
    stand-in: initiation always succeeds with a synthetic reference id, and
    verification always reports success. Exists so the Transaction
    Pending -> Success lifecycle can be exercised end-to-end without a
    configured gateway. Tests exercise the Failed path by passing a fake
    provider directly to verify_transaction(), not by making this provider
    lie about succeeding.
    """

    name = 'development-mock'

    def initiate(self, txn):
        return PaymentInitiationResult(
            reference_id=f'MOCK-{txn.pk}',
            provider=self.name,
            mock=True,
        )

    def verify(self, txn):
        return PaymentVerificationResult(success=True)


def get_payment_provider():
    return DevelopmentMockPaymentProvider()


def create_pending_transaction(user, plan, duration_months, provider=None):
    """
    Step 1 of the purchase flow: validate the request, snapshot price/tier
    onto a new Pending Transaction, and ask the payment provider to initiate
    payment. Never creates a UserSubscription — that only ever happens once
    verify_transaction() sees a successful result.

    Raises django.core.exceptions.ValidationError for: an invalid duration,
    an attempt to "purchase" Basic (it's free and is the automatic fallback
    plan — see module docstring in services.py), or an inactive plan.
    """
    if duration_months not in ALLOWED_DURATIONS_MONTHS:
        raise ValidationError(
            f'Invalid subscription duration: {duration_months!r} months. '
            f'Allowed durations are {ALLOWED_DURATIONS_MONTHS}.'
        )

    if plan.tier == SubscriptionPlan.Tier.BASIC:
        raise ValidationError(
            'Basic is free and is the automatic fallback plan; it does not '
            'require a purchase transaction.'
        )

    if not plan.is_active:
        raise ValidationError('This plan is not currently available for purchase.')

    # Explicit duration -> price field, never monthly_price * duration, so a
    # future stepped-discount change to price_3_months etc. is respected.
    amount = getattr(plan, PRICE_FIELD_BY_DURATION[duration_months])

    provider = provider or get_payment_provider()

    with db_transaction.atomic():
        txn = Transaction.objects.create(
            user=user,
            plan=plan,
            plan_tier_snapshot=plan.tier,
            duration_months=duration_months,
            amount=amount,
            status=Transaction.Status.PENDING,
        )
        initiation = provider.initiate(txn)
        txn.gateway_reference_id = initiation.reference_id
        txn.save(update_fields=['gateway_reference_id'])

    return txn, initiation


def verify_transaction(transaction_id, provider=None):
    """
    Step 2: verify a Transaction and, only on a successful result, activate
    the subscription through the existing Phase 3 service.

    Idempotent: a Transaction already in a terminal state (Success or
    Failed) is returned as-is without calling the provider or touching
    anything else — repeated/duplicate verification calls (e.g. duplicate
    gateway callbacks) can never create a second UserSubscription, and a
    Failed Transaction is never silently resurrected into Success on retry
    (a new purchase/Transaction is required for that).

    Marking the Transaction Success and calling activate_subscription()
    happen inside one atomic block with the Transaction row locked
    (select_for_update): if activation raises for any reason, the entire
    block rolls back and the Transaction is left exactly as it was before
    this call — never Success with a NULL user_subscription.
    """
    provider = provider or get_payment_provider()

    with db_transaction.atomic():
        txn = (
            Transaction.objects.select_for_update()
            .select_related('plan', 'user')
            .get(pk=transaction_id)
        )

        if txn.status in (Transaction.Status.SUCCESS, Transaction.Status.FAILED):
            return txn

        result = provider.verify(txn)

        if not result.success:
            txn.status = Transaction.Status.FAILED
            txn.verified_at = timezone.now()
            txn.save(update_fields=['status', 'verified_at'])
            return txn

        # activate_subscription() also syncs User.subscription — reused
        # as-is, not reimplemented here.
        subscription = activate_subscription(txn.user, txn.plan, txn.duration_months)

        txn.status = Transaction.Status.SUCCESS
        txn.verified_at = timezone.now()
        txn.user_subscription = subscription
        txn.save(update_fields=['status', 'verified_at', 'user_subscription'])

    return txn
