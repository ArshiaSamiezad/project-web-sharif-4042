from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Case, IntegerField, Value, When
from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import generics, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.models import User

from . import payment, services
from .models import SubscriptionPlan, Transaction, UserSubscription
from .serializers import (
    CurrentSubscriptionSerializer,
    SubscriptionPlanSerializer,
    TransactionSerializer,
    UserSubscriptionHistorySerializer,
)

# Deliberate display order (Basic, Silver, Gold) — not alphabetical, and not
# reliant on row insertion order.
TIER_DISPLAY_ORDER = (
    SubscriptionPlan.Tier.BASIC,
    SubscriptionPlan.Tier.SILVER,
    SubscriptionPlan.Tier.GOLD,
)


def _parse_required_int(raw_value, field_name):
    if raw_value is None or raw_value == '':
        raise serializers.ValidationError({field_name: f'{field_name} is required.'})
    try:
        return int(raw_value)
    except (TypeError, ValueError):
        raise serializers.ValidationError({field_name: f'{field_name} must be a valid integer.'})


def _parse_user_id(raw_user_id):
    return _parse_required_int(raw_user_id, 'userId')


def _effective_subscription_payload(user):
    subscription = services.get_effective_subscription(user)
    plan = subscription.plan if subscription is not None else services.get_basic_plan()
    return CurrentSubscriptionSerializer(
        {'user': user, 'plan': plan, 'subscription': subscription}
    ).data


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


class PurchaseView(APIView):
    """
    POST userId/planId/durationMonths -> creates a Pending Transaction and
    asks the (development/mock) payment provider to initiate payment. Never
    activates a subscription directly — see payment.create_pending_transaction.
    """

    def post(self, request):
        user_id = _parse_required_int(request.data.get('userId'), 'userId')
        plan_id = _parse_required_int(request.data.get('planId'), 'planId')
        duration_months = _parse_required_int(request.data.get('durationMonths'), 'durationMonths')

        user = get_object_or_404(User, pk=user_id)
        plan = get_object_or_404(SubscriptionPlan, pk=plan_id)

        try:
            txn, initiation = payment.create_pending_transaction(user, plan, duration_months)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'detail': exc.messages})

        return Response(
            {
                'transaction': TransactionSerializer(txn).data,
                'payment': {
                    'provider': initiation.provider,
                    'mock': initiation.mock,
                    'referenceId': initiation.reference_id,
                    'message': (
                        'Development/mock payment flow — no real charge occurs. '
                        'Call /api/subscriptions/verify/ with this transactionId to complete it.'
                    ),
                },
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyTransactionView(APIView):
    """
    POST transactionId -> verifies the Transaction and, only on success,
    activates the subscription (via the existing Phase 3 service, reached
    through payment.verify_transaction). Idempotent — see that function's
    docstring for exactly how repeated calls are handled.
    """

    def post(self, request):
        transaction_id = _parse_required_int(request.data.get('transactionId'), 'transactionId')

        try:
            txn = payment.verify_transaction(transaction_id)
        except Transaction.DoesNotExist:
            raise Http404('Transaction not found.')

        return Response(
            {
                'transaction': TransactionSerializer(txn).data,
                'effectiveSubscription': _effective_subscription_payload(txn.user),
            }
        )
