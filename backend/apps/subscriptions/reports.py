"""
Read-only reporting aggregation (Phase 7).

Pure ORM aggregation over the existing Transaction / UserSubscription /
SubscriptionPlan / User tables — no new models, no background jobs, no
per-row Python loops. Every function here runs a small, fixed number of
queries regardless of how many rows exist.

Effective-subscription semantics deliberately mirror services.py's
definition (status=Active AND start_date<=today<end_date) rather than
trusting the stored `status` column alone, for two reasons that matter
specifically for reporting:

1. Future scheduled subscriptions are stored with status=Active too (see
   services.py's module docstring) — counting every Active row as
   "currently effective" would overcount by including subscriptions that
   haven't started yet.

2. Expiration is lazy: services._expire_lapsed_subscriptions() only flips
   a row from Active to Expired when something actually reads that specific
   user's subscriptions (get_effective_subscription / activate_subscription).
   A reporting query run over the whole table has no reason to have
   touched every user, so some already-lapsed rows may still say
   status=Active in the database. Reports must never issue writes just to
   "catch up" stale rows (that would make a GET request silently mutate
   data), so "expired" here is computed the same way "effective" is: from
   the date range, not the possibly-stale status column. This is why the
   four buckets below (effective / future-scheduled / expired / cancelled)
   are mutually exclusive and sum to the total regardless of whether lazy
   expiration has run recently.
"""
from django.db.models import Count, Q, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone

from apps.users.models import User

from .models import SubscriptionPlan, Transaction, UserSubscription
from .serializers import TransactionSerializer, UserSubscriptionHistorySerializer

RECENT_TRANSACTIONS_LIMIT = 10
RECENT_SUBSCRIPTIONS_LIMIT = 10

# Matches the frontend's existing "who counts as a subscriber" filter
# (StaffSubscriptionsPage's getSubscriptionStats excludes staff/support/
# admin accounts from plan-distribution counts).
PLAN_DISTRIBUTION_ROLES = (User.Role.LISTENER, User.Role.ARTIST)


def get_financial_summary():
    totals = Transaction.objects.aggregate(
        total_revenue=Coalesce(
            Sum('amount', filter=Q(status=Transaction.Status.SUCCESS)), 0
        ),
        successful_count=Count('id', filter=Q(status=Transaction.Status.SUCCESS)),
        pending_count=Count('id', filter=Q(status=Transaction.Status.PENDING)),
        failed_count=Count('id', filter=Q(status=Transaction.Status.FAILED)),
    )

    # Grouped by the immutable plan_tier_snapshot / duration_months on the
    # Transaction itself, not by joining to the live SubscriptionPlan — a
    # later price or tier change must never alter historical revenue.
    revenue_by_plan = [
        {'tier': row['plan_tier_snapshot'], 'revenue': row['revenue'], 'count': row['count']}
        for row in (
            Transaction.objects.filter(status=Transaction.Status.SUCCESS)
            .values('plan_tier_snapshot')
            .annotate(revenue=Sum('amount'), count=Count('id'))
            .order_by('plan_tier_snapshot')
        )
    ]

    revenue_by_duration = [
        {
            'durationMonths': row['duration_months'],
            'revenue': row['revenue'],
            'count': row['count'],
        }
        for row in (
            Transaction.objects.filter(status=Transaction.Status.SUCCESS)
            .values('duration_months')
            .annotate(revenue=Sum('amount'), count=Count('id'))
            .order_by('duration_months')
        )
    ]

    recent_transactions = TransactionSerializer(
        Transaction.objects.select_related('plan', 'user_subscription__plan')
        .order_by('-created_at', '-id')[:RECENT_TRANSACTIONS_LIMIT],
        many=True,
    ).data

    return {
        'totalRevenue': totals['total_revenue'],
        'successfulTransactionCount': totals['successful_count'],
        'pendingTransactionCount': totals['pending_count'],
        'failedTransactionCount': totals['failed_count'],
        'revenueByPlan': revenue_by_plan,
        'revenueByDuration': revenue_by_duration,
        'recentTransactions': recent_transactions,
    }


def get_subscription_summary():
    today = timezone.localdate()

    is_effective = Q(
        status=UserSubscription.Status.ACTIVE,
        start_date__lte=today,
        end_date__gt=today,
    )
    is_future_scheduled = Q(status=UserSubscription.Status.ACTIVE, start_date__gt=today)
    is_cancelled = Q(status=UserSubscription.Status.CANCELLED)
    # Date-derived, not status__exact='expired' — see module docstring.
    is_expired = Q(end_date__lte=today) & ~is_cancelled

    counts = UserSubscription.objects.aggregate(
        total=Count('id'),
        effective=Count('id', filter=is_effective),
        future_scheduled=Count('id', filter=is_future_scheduled),
        expired=Count('id', filter=is_expired),
        cancelled=Count('id', filter=is_cancelled),
    )

    subscriptions_by_plan = [
        {'tier': row['plan__tier'], 'count': row['count']}
        for row in (
            UserSubscription.objects.filter(is_effective)
            .values('plan__tier')
            .annotate(count=Count('id'))
            .order_by('plan__tier')
        )
    ]

    subscriptions_by_status = [
        {'status': 'active', 'count': counts['effective']},
        {'status': 'future_scheduled', 'count': counts['future_scheduled']},
        {'status': 'expired', 'count': counts['expired']},
        {'status': 'cancelled', 'count': counts['cancelled']},
    ]

    recent_subscriptions = UserSubscriptionHistorySerializer(
        UserSubscription.objects.select_related('plan').order_by('-created_at', '-id')[
            :RECENT_SUBSCRIPTIONS_LIMIT
        ],
        many=True,
    ).data

    return {
        'totalSubscriptionRecords': counts['total'],
        'activeEffectiveSubscriptions': counts['effective'],
        'futureScheduledSubscriptions': counts['future_scheduled'],
        'expiredSubscriptions': counts['expired'],
        'cancelledSubscriptions': counts['cancelled'],
        'subscriptionsByPlan': subscriptions_by_plan,
        'subscriptionsByStatus': subscriptions_by_status,
        'recentSubscriptions': recent_subscriptions,
    }


def get_plan_distribution():
    """
    Effective-plan distribution across real listener/artist users, without
    ever looping per user or calling services.get_effective_plan() in a
    loop: a Basic count is derived as
        total_relevant_users - (silver_effective_users + gold_effective_users)
    which is exactly equivalent to summing get_effective_plan(user) over
    every user, since by construction each user has at most one currently
    effective UserSubscription and "no effective row" is precisely the
    Basic-fallback condition Phase 3 already defines.
    """
    today = timezone.localdate()

    total_users = User.objects.filter(role__in=PLAN_DISTRIBUTION_ROLES).count()

    paid_counts = dict(
        UserSubscription.objects.filter(
            status=UserSubscription.Status.ACTIVE,
            start_date__lte=today,
            end_date__gt=today,
            user__role__in=PLAN_DISTRIBUTION_ROLES,
        )
        .values('plan__tier')
        .annotate(count=Count('user_id', distinct=True))
        .values_list('plan__tier', 'count')
    )

    silver_users = paid_counts.get(SubscriptionPlan.Tier.SILVER, 0)
    gold_users = paid_counts.get(SubscriptionPlan.Tier.GOLD, 0)
    basic_users = total_users - silver_users - gold_users

    return {
        'basicUsers': basic_users,
        'silverUsers': silver_users,
        'goldUsers': gold_users,
        'totalUsers': total_users,
    }


def get_reports_overview():
    return {
        'planDistribution': get_plan_distribution(),
        'subscriptions': get_subscription_summary(),
        'finance': get_financial_summary(),
    }
