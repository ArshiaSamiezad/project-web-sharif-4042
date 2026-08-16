"""
Subscription business logic (Phase 3).

Status strategy
----------------
The model only has Active / Expired / Cancelled — there is no "Scheduled"
status for future subscriptions. A future subscription (start_date in the
future) is stored with status=Active, same as a currently running one.

"Effective" is therefore never decided from status alone: a subscription is
the user's *current effective* subscription only when

    status == Active AND start_date <= today < end_date

Status is only used to distinguish "still relevant" (Active) from "no longer
relevant" (Expired/Cancelled) rows; date range decides *current* vs *future*
among the Active ones. This lets multiple Active rows coexist per user (one
current + several scheduled) without any schema change or unique constraint,
which matches the instruction not to add a "one Active row per user"
constraint.

Expiration is handled lazily: every read path that cares about "current"
state first flips any Active row whose end_date has already passed to
Expired (single bulk UPDATE, only touches rows that actually lapsed).
"""
import calendar

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from .models import SubscriptionPlan, UserSubscription

ALLOWED_DURATIONS_MONTHS = (1, 3, 6, 12)

# Basic is an application invariant, not optional catalog data.  Keep the
# fallback usable even when an old/development database has had its seeded
# plan rows removed after the original data migration ran.
BASIC_PLAN_DEFAULTS = {
    'name': 'Basic',
    'price_1_month': 0,
    'price_3_months': 0,
    'price_6_months': 0,
    'price_12_months': 0,
    'daily_stream_limit': 60,
    'playlist_limit': 6,
    'can_download': False,
    'can_upload_profile_photo': False,
    'has_early_access': False,
    'has_stats_access': False,
    'is_active': True,
}


def _add_calendar_months(base_date, months):
    """base_date shifted forward by `months` calendar months (not 30*months days)."""
    month_index = base_date.month - 1 + months
    year = base_date.year + month_index // 12
    month = month_index % 12 + 1
    day = min(base_date.day, calendar.monthrange(year, month)[1])
    return base_date.replace(year=year, month=month, day=day)


def _expire_lapsed_subscriptions(user):
    """Flip this user's Active-but-past-end_date rows to Expired. Bulk, no-op if none lapsed."""
    today = timezone.localdate()
    UserSubscription.objects.filter(
        user=user,
        status=UserSubscription.Status.ACTIVE,
        end_date__lte=today,
    ).update(status=UserSubscription.Status.EXPIRED)


def get_basic_plan():
    """The fallback SubscriptionPlan (tier=basic) every user without a paid plan gets."""
    plan, _ = SubscriptionPlan.objects.get_or_create(
        tier=SubscriptionPlan.Tier.BASIC,
        defaults=BASIC_PLAN_DEFAULTS,
    )
    return plan


def get_effective_subscription(user):
    """
    The UserSubscription currently in effect for `user`, or None if they have
    no currently-running paid subscription (fallback to Basic is the caller's
    job — see get_effective_plan). Lazily expires lapsed rows first.
    """
    _expire_lapsed_subscriptions(user)
    today = timezone.localdate()
    return (
        UserSubscription.objects.filter(
            user=user,
            status=UserSubscription.Status.ACTIVE,
            start_date__lte=today,
            end_date__gt=today,
        )
        .select_related('plan')
        .order_by('-start_date', '-id')
        .first()
    )


def get_effective_plan(user):
    """The SubscriptionPlan `user` currently has access to: their effective paid plan, or Basic."""
    subscription = get_effective_subscription(user)
    if subscription is not None:
        return subscription.plan
    return get_basic_plan()


def sync_user_subscription_tier(user):
    """
    Single central place that writes User.subscription. Sets it to the tier
    of the user's current effective plan (Basic when there is none) and
    saves only if it actually changed. Returns the tier that was set.
    """
    tier = get_effective_plan(user).tier
    if user.subscription != tier:
        user.subscription = tier
        user.save(update_fields=['subscription'])

    # Authentication and catalog users are separate legacy models. Keep the
    # authenticated account in sync so JWT profile responses expose purchases.
    from django.contrib.auth import get_user_model

    get_user_model().objects.filter(email__iexact=user.email).exclude(
        subscription=tier
    ).update(subscription=tier)
    return tier


def activate_subscription(user, plan, duration_months):
    """
    Create a new UserSubscription for `user` on `plan` for `duration_months`.
    Meant to be called after a payment is verified successful (Phase 5) —
    never modifies an existing row, always appends a new history record.

    Scheduling:
    - No current/future paid subscription -> starts today.
    - One exists -> new period starts exactly when the latest one (current
      or already-scheduled) ends, so periods never overlap regardless of how
      many are already queued up.

    Wrapped in transaction.atomic() with select_for_update() on the user's
    rows so two concurrent activations (e.g. duplicate payment callbacks)
    can't both read the same "latest end" and create overlapping periods.
    """
    if duration_months not in ALLOWED_DURATIONS_MONTHS:
        raise ValidationError(
            f'Invalid subscription duration: {duration_months!r} months. '
            f'Allowed durations are {ALLOWED_DURATIONS_MONTHS}.'
        )

    with transaction.atomic():
        _expire_lapsed_subscriptions(user)
        today = timezone.localdate()

        locked_end_dates = list(
            UserSubscription.objects.select_for_update()
            .filter(
                user=user,
                status=UserSubscription.Status.ACTIVE,
                end_date__gt=today,
            )
            .values_list('end_date', flat=True)
        )
        start_date = max(locked_end_dates) if locked_end_dates else today
        end_date = _add_calendar_months(start_date, duration_months)

        subscription = UserSubscription.objects.create(
            user=user,
            plan=plan,
            start_date=start_date,
            end_date=end_date,
            status=UserSubscription.Status.ACTIVE,
        )

    sync_user_subscription_tier(user)
    return subscription
