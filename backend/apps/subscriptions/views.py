from django.db.models import Case, IntegerField, Value, When
from django.shortcuts import get_object_or_404
from rest_framework import generics, serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.models import User

from . import services
from .models import SubscriptionPlan, UserSubscription
from .serializers import (
    CurrentSubscriptionSerializer,
    SubscriptionPlanSerializer,
    UserSubscriptionHistorySerializer,
)

# Deliberate display order (Basic, Silver, Gold) — not alphabetical, and not
# reliant on row insertion order.
TIER_DISPLAY_ORDER = (
    SubscriptionPlan.Tier.BASIC,
    SubscriptionPlan.Tier.SILVER,
    SubscriptionPlan.Tier.GOLD,
)


def _parse_user_id(raw_user_id):
    if not raw_user_id:
        raise serializers.ValidationError({'userId': 'userId is required.'})
    try:
        return int(raw_user_id)
    except (TypeError, ValueError):
        raise serializers.ValidationError({'userId': 'userId must be a valid integer.'})


class SubscriptionPlanListView(generics.ListAPIView):
    serializer_class = SubscriptionPlanSerializer
    pagination_class = None

    def get_queryset(self):
        tier_rank = Case(
            *[
                When(tier=tier, then=Value(index))
                for index, tier in enumerate(TIER_DISPLAY_ORDER)
            ],
            default=Value(len(TIER_DISPLAY_ORDER)),
            output_field=IntegerField(),
        )
        return (
            SubscriptionPlan.objects.filter(is_active=True)
            .annotate(_tier_rank=tier_rank)
            .order_by('_tier_rank', 'id')
        )


class CurrentSubscriptionView(APIView):
    def get(self, request):
        user_id = _parse_user_id(request.query_params.get('userId'))
        user = get_object_or_404(User, pk=user_id)

        subscription = services.get_effective_subscription(user)
        plan = subscription.plan if subscription is not None else services.get_basic_plan()
        services.sync_user_subscription_tier(user)

        serializer = CurrentSubscriptionSerializer(
            {'user': user, 'plan': plan, 'subscription': subscription}
        )
        return Response(serializer.data)


class SubscriptionHistoryView(generics.ListAPIView):
    serializer_class = UserSubscriptionHistorySerializer
    pagination_class = None

    def get_queryset(self):
        user_id = _parse_user_id(self.request.query_params.get('userId'))
        get_object_or_404(User, pk=user_id)
        return (
            UserSubscription.objects.filter(user_id=user_id)
            .select_related('plan')
            .order_by('-start_date', '-id')
        )
