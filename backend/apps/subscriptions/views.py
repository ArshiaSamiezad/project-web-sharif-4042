from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Case, IntegerField, Value, When
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404, redirect
from rest_framework import generics, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.models import User

from . import payment, reports, services
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
        user_id = _parse_required_int(request.query_params.get('userId'), 'userId')
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
        user_id = _parse_required_int(self.request.query_params.get('userId'), 'userId')
        get_object_or_404(User, pk=user_id)
        return (
            UserSubscription.objects.filter(user_id=user_id)
            .select_related('plan')
            .order_by('-start_date', '-id')
        )


class PurchaseView(APIView):
    """
    POST userId/planId/durationMonths -> creates a Pending Transaction,
    asks the active payment gateway to initiate payment, and returns a
    paymentUrl for the browser to be redirected to. Never activates a
    subscription directly, and there is no endpoint the frontend can call
    to activate one itself — only a gateway-confirmed callback can (see
    PaymentCallbackView). See payment.create_pending_transaction.
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
        except payment.PaymentGatewayError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        return Response(
            {
                'transaction': TransactionSerializer(txn).data,
                'paymentUrl': initiation.payment_url,
                'provider': initiation.provider,
                'mock': initiation.mock,
            },
            status=status.HTTP_201_CREATED,
        )


class PaymentCallbackView(APIView):
    """
    GET-only, gateway-facing — the gateway redirects the user's browser
    here after they complete or cancel payment. This is NOT an endpoint our
    own frontend JS ever calls directly; it is the only path that can mark
    a Transaction Success and grant a subscription (see
    payment.handle_payment_callback for the actual verification/activation
    logic — this view is just query-param parsing + the final redirect).

    Always ends by redirecting the browser to FRONTEND_PAYMENT_RESULT_URL
    with the outcome — never returns JSON, since the party hitting this URL
    is a browser being navigated by the gateway, not our API client.
    """

    def get(self, request):
        authority = request.query_params.get('Authority', '')
        gateway_status = request.query_params.get('Status', '')

        if not authority:
            return redirect(f'{settings.FRONTEND_PAYMENT_RESULT_URL}?status=failed&reason=missing_authority')

        try:
            txn = payment.handle_payment_callback(authority, gateway_status)
        except Transaction.DoesNotExist:
            return redirect(f'{settings.FRONTEND_PAYMENT_RESULT_URL}?status=failed&reason=not_found')
        except payment.PaymentGatewayError:
            return redirect(f'{settings.FRONTEND_PAYMENT_RESULT_URL}?status=failed&reason=gateway_error')

        outcome = 'success' if txn.status == Transaction.Status.SUCCESS else 'failed'
        return redirect(
            f'{settings.FRONTEND_PAYMENT_RESULT_URL}?status={outcome}&transactionId={txn.pk}'
        )


class MockGatewayPageView(APIView):
    """
    Stand-in for a real gateway's hosted checkout page — only reachable
    when PAYMENT_GATEWAY_PROVIDER=mock. Lets a developer manually exercise
    the full redirect-away-and-back flow locally with no real gateway
    credentials: the browser genuinely leaves our React app, lands here,
    and clicking a link redirects back to PaymentCallbackView with
    ?Status=OK/NOK — the same shape a real gateway redirect has. Never
    reachable when a real gateway is configured (see the guard below).
    """

    def get(self, request):
        if getattr(settings, 'PAYMENT_GATEWAY_PROVIDER', 'mock') != 'mock':
            raise Http404('The mock gateway page is only available in mock mode.')

        authority = request.query_params.get('authority', '')
        callback = request.query_params.get('callback', '')
        pay_url = f'{callback}?Authority={authority}&Status=OK'
        cancel_url = f'{callback}?Authority={authority}&Status=NOK'
        html = f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Development Payment Gateway</title></head>
<body style="font-family:sans-serif;max-width:420px;margin:80px auto;text-align:center">
<h2>Development Payment Gateway</h2>
<p><strong>This is not a real payment gateway.</strong> It only exists
because PAYMENT_GATEWAY_PROVIDER=mock — no real gateway is configured.</p>
<p>Authority: <code>{authority}</code></p>
<p><a href="{pay_url}" style="display:inline-block;margin:8px;padding:10px 20px;
background:#2a2;color:#fff;text-decoration:none;border-radius:6px;">
Simulate Successful Payment</a></p>
<p><a href="{cancel_url}" style="display:inline-block;margin:8px;padding:10px 20px;
background:#a22;color:#fff;text-decoration:none;border-radius:6px;">
Simulate Cancel</a></p>
</body></html>"""
        return HttpResponse(html)


class ReportsOverviewView(APIView):
    """
    GET-only staff dashboard: real, database-backed plan distribution,
    subscription summary, and financial summary — see reports.py for the
    aggregation itself.

    Authorization caveat (documented, not hidden): this project has no
    authentication system, so "only admins can see this" cannot be a real
    security boundary here. This endpoint follows the same explicit-id
    convention already used everywhere else in this API (userId identifies
    who's asking) and checks that user's `role`, exactly mirroring the
    frontend's own isStaff()/isAdmin() gate on StaffSubscriptionsPage. Any
    client that supplies a real admin's id can pass this check — it is not
    protection against a malicious client, only a convention-consistent
    gate matching the rest of this unauthenticated API.
    """

    def get(self, request):
        user_id = _parse_required_int(request.query_params.get('userId'), 'userId')
        requester = get_object_or_404(User, pk=user_id)
        if requester.role != User.Role.ADMIN:
            raise PermissionDenied('Only admin accounts can view subscription reports.')

        return Response(reports.get_reports_overview())
