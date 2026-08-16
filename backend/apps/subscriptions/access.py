"""
Access-control helpers (Phase 6): thin gates that OTHER apps call to enforce
SubscriptionPlan capabilities against endpoints that already exist.

Every helper resolves the plan through services.get_effective_plan(user) —
never through the (possibly stale) User.subscription field directly — so
lazy expiration, Basic fallback, and scheduled-future-subscription rules
are always honored, exactly as Phase 3 designed them. Nothing here
reimplements or duplicates that logic.

Raising django.core.exceptions.PermissionDenied is deliberate: DRF's
default exception handler turns it into a 403 automatically, which is
distinguishable from a 400 (bad input) or 404 (missing object) without any
custom exception handling in the calling app.

Only helpers for capabilities that have a real integration point in this
repository are defined here — see the Phase 6 report for what plan
features (daily_stream_limit, can_download) have no backend feature to
attach to yet and were intentionally left unintegrated.
"""
from django.core.exceptions import PermissionDenied

from .services import get_basic_plan, get_effective_plan


def get_user_effective_plan(user):
    return get_effective_plan(user)


def ensure_playlist_creation_allowed(user, current_playlist_count):
    """Raises PermissionDenied if `user` is already at their plan's playlist_limit."""
    plan = get_effective_plan(user)
    limit = plan.playlist_limit
    if limit is not None and current_playlist_count >= limit:
        raise PermissionDenied('Playlist limit reached for your current subscription plan.')


def ensure_profile_photo_upload_allowed(user):
    """Raises PermissionDenied if `user`'s plan does not include profile photo uploads."""
    plan = get_effective_plan(user)
    if not plan.can_upload_profile_photo:
        raise PermissionDenied(
            'Your current subscription plan does not allow profile photo uploads.'
        )


def ensure_new_user_profile_photo_upload_allowed():
    """
    Same gate as ensure_profile_photo_upload_allowed(), for the one case
    with no persisted user yet to resolve an effective plan for (creating a
    new User). A not-yet-existing user can't have any UserSubscription row,
    so their effective plan is unconditionally Basic — checked against the
    real Basic plan (not a hardcoded flag) so a future change to Basic's
    capabilities is still respected here too.
    """
    if not get_basic_plan().can_upload_profile_photo:
        raise PermissionDenied(
            'Your current subscription plan does not allow profile photo uploads.'
        )


def ensure_early_access_allowed(user):
    """Raises PermissionDenied if `user`'s plan does not include early access content."""
    plan = get_effective_plan(user)
    if not plan.has_early_access:
        raise PermissionDenied(
            'Your current subscription plan does not include early access content.'
        )
