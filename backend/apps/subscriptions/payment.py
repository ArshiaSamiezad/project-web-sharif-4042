"""
Payment gateway abstraction + Transaction orchestration (Phase 5, upgraded
to a real gateway-redirect flow).

Architecture
------------
Two things used to happen in the wrong place: the mock provider always
reported success, and the frontend was the one deciding *when* to call
verification (immediately after purchase, every time). Both are fixed here.

    create_pending_transaction()  — POST /subscriptions/purchase/
        Validates the request, snapshots price/tier onto a new Pending
        Transaction, asks the active PaymentGateway to initiate payment,
        and returns a `payment_url` for the browser to be redirected to.
        Never activates anything.

    handle_payment_callback()     — GET /subscriptions/payments/callback/
        The ONLY path that can ever mark a Transaction Success and grant a
        subscription. Reached exclusively by the gateway redirecting the
        user's browser back to us — never called directly by our own
        frontend JS. Independently re-verifies with the gateway
        server-to-server before trusting anything; the query-string
        "Status" the gateway put on the redirect URL is treated as an
        untrusted hint, never as proof.

PaymentGateway interface
-------------------------
get_payment_provider() returns whichever gateway PAYMENT_GATEWAY_PROVIDER
selects. Every provider implements the same two methods:

    initiate(txn) -> PaymentInitiationResult(authority, payment_url, provider, mock)
    verify(txn)   -> PaymentVerificationResult(success, ref_id)

- ZarinPalGateway: the real gateway (sandbox or production, chosen by
  ZARINPAL_SANDBOX). Talks to ZarinPal's REST API over HTTPS.
- DevelopmentMockGateway: a deterministic, no-network stand-in used when
  PAYMENT_GATEWAY_PROVIDER=mock (the default — see settings.py). Its
  payment_url points at a tiny locally-served "fake gateway" page
  (MockGatewayPageView) so the full redirect-away-and-back cycle is still
  genuinely exercised in local dev, rather than the frontend pretending
  payment happened. Automated tests inject their own FakeGateway instead
  of relying on either of these — see tests.py.
"""
import json
import urllib.error
import urllib.request
from dataclasses import dataclass
from urllib.parse import quote
from uuid import uuid4

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured, ValidationError
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


class PaymentGatewayError(Exception):
    """The gateway itself couldn't be reached or rejected the request (not
    the same as a declined/failed payment — that's a normal Transaction
    outcome, this is an infrastructure-level failure)."""


@dataclass
class PaymentInitiationResult:
    authority: str
    payment_url: str
    provider: str
    mock: bool


@dataclass
class PaymentVerificationResult:
    success: bool
    ref_id: str = ''


class DevelopmentMockGateway:
    """
    NOT a real payment gateway. Selected only via PAYMENT_GATEWAY_PROVIDER=
    mock (the default when no real gateway is configured, so local dev and
    `manage.py test` work without internet access or ZarinPal credentials).

    initiate() fabricates an unguessable authority and points payment_url at
    MockGatewayPageView — a real page the browser is actually redirected to,
    with "Pay"/"Cancel" links that redirect back to our real callback URL
    with ?Status=OK/NOK, exactly like a real gateway would. verify() then
    simply confirms the transaction was reached via that flow; it does not
    independently re-derive success the way a real gateway integration
    would, which is why this class must never be reachable in production
    (see get_payment_provider()).
    """

    name = 'development-mock'

    def initiate(self, txn):
        authority = f'MOCK-{txn.pk}-{uuid4().hex[:12]}'
        callback = quote(settings.PAYMENT_CALLBACK_URL, safe='')
        payment_url = (
            f'{settings.PAYMENT_MOCK_GATEWAY_URL}?authority={authority}&callback={callback}'
        )
        return PaymentInitiationResult(
            authority=authority, payment_url=payment_url, provider=self.name, mock=True,
        )

    def verify(self, txn):
        return PaymentVerificationResult(success=True, ref_id=f'MOCK-REF-{txn.pk}')


class ZarinPalGateway:
    """
    Real ZarinPal gateway (REST API v4). Selected via
    PAYMENT_GATEWAY_PROVIDER=zarinpal. Sandbox vs production is chosen by
    ZARINPAL_SANDBOX (defaults to sandbox — see settings.py).

    Amounts: SubscriptionPlan prices / Transaction.amount are stored in
    Tomans throughout this app (unchanged, matches every existing report/
    test/display) — ZarinPal's v4 API expects Rials (1 Toman = 10 Rials),
    so the conversion happens only at the two points that actually talk to
    the gateway, never in the stored data.

    Note: verify the exact request/verify/StartPay endpoint paths against
    ZarinPal's current documentation before relying on this in production —
    they're implemented here from the long-stable v4 REST contract, but
    this code was written without live network access to re-confirm them.
    """

    name = 'zarinpal'
    _request_path = '/pg/v4/payment/request.json'
    _verify_path = '/pg/v4/payment/verify.json'
    _startpay_path = '/pg/StartPay/{authority}'
    _rial_per_toman = 10

    def __init__(self, merchant_id, callback_url, sandbox=True, timeout=15):
        if not merchant_id:
            raise ImproperlyConfigured(
                'ZARINPAL_MERCHANT_ID must be set when PAYMENT_GATEWAY_PROVIDER=zarinpal.'
            )
        self.merchant_id = merchant_id
        self.callback_url = callback_url
        self.sandbox = sandbox
        self.timeout = timeout

    @property
    def _host(self):
        return 'sandbox.zarinpal.com' if self.sandbox else 'payment.zarinpal.com'

    def _post_json(self, path, payload):
        url = f'https://{self._host}{path}'
        data = json.dumps(payload).encode('utf-8')
        request = urllib.request.Request(
            url,
            data=data,
            headers={'Content-Type': 'application/json', 'Accept': 'application/json'},
            method='POST',
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                return json.loads(response.read().decode('utf-8'))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError) as exc:
            raise PaymentGatewayError(f'ZarinPal request to {path} failed: {exc}') from exc

    def initiate(self, txn):
        payload = {
            'merchant_id': self.merchant_id,
            'amount': txn.amount * self._rial_per_toman,
            'callback_url': self.callback_url,
            'description': f'Sepatify subscription #{txn.pk} ({txn.plan_tier_snapshot})',
        }
        result = self._post_json(self._request_path, payload)
        data = result.get('data') or {}
        if data.get('code') != 100:
            raise PaymentGatewayError(
                f'ZarinPal payment request rejected: {result.get("errors") or data}'
            )
        authority = data['authority']
        payment_url = f'https://{self._host}{self._startpay_path.format(authority=authority)}'
        return PaymentInitiationResult(
            authority=authority, payment_url=payment_url, provider=self.name, mock=False,
        )

    def verify(self, txn):
        payload = {
            'merchant_id': self.merchant_id,
            'amount': txn.amount * self._rial_per_toman,
            'authority': txn.gateway_reference_id,
        }
        result = self._post_json(self._verify_path, payload)
        data = result.get('data') or {}
        code = data.get('code')
        # 100 = freshly verified success; 101 = "already verified" — ZarinPal's
        # own idempotency signal for a repeated verify call on the same
        # authority. Both mean the payment is genuinely successful; anything
        # else (including a missing code) is not.
        success = code in (100, 101)
        return PaymentVerificationResult(success=success, ref_id=str(data.get('ref_id', '')))


def get_payment_provider():
    provider_name = getattr(settings, 'PAYMENT_GATEWAY_PROVIDER', 'mock')
    if provider_name == 'zarinpal':
        return ZarinPalGateway(
            merchant_id=settings.ZARINPAL_MERCHANT_ID,
            callback_url=settings.PAYMENT_CALLBACK_URL,
            sandbox=settings.ZARINPAL_SANDBOX,
        )
    if provider_name == 'mock':
        return DevelopmentMockGateway()
    raise ImproperlyConfigured(f'Unknown PAYMENT_GATEWAY_PROVIDER: {provider_name!r}')


def create_pending_transaction(user, plan, duration_months, provider=None):
    """
    Step 1 of the purchase flow: validate the request, snapshot price/tier
    onto a new Pending Transaction, and ask the payment gateway to initiate
    payment. Never creates a UserSubscription — that only ever happens once
    handle_payment_callback() sees a gateway-confirmed successful result.

    Raises django.core.exceptions.ValidationError for: an invalid duration,
    an attempt to "purchase" Basic (it's free and is the automatic fallback
    plan — see services.py), or an inactive plan. Raises PaymentGatewayError
    if the gateway itself can't be reached or rejects the request — in that
    case the Transaction row is never committed (see the atomic block
    below), so a failed gateway call never leaves Pending litter behind.
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
    # This is the ONLY place the amount ever comes from — never trust a
    # price/amount sent by the client, and the purchase request never
    # accepts one.
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
        # If the gateway call raises, this whole block (including the
        # Transaction row above) rolls back — no orphaned Pending row.
        initiation = provider.initiate(txn)
        txn.gateway_reference_id = initiation.authority
        txn.save(update_fields=['gateway_reference_id'])

    return txn, initiation


def handle_payment_callback(authority, gateway_reported_status, provider=None):
    """
    Step 2: the gateway's redirect-back callback. `authority` identifies the
    Transaction (matches gateway_reference_id, set at initiate() time —
    unguessable, issued by the gateway itself, never chosen by the client).
    `gateway_reported_status` is whatever status the gateway put on the
    redirect URL (e.g. ZarinPal's Status=OK/NOK) — this comes from a
    user-controlled browser redirect and is NEVER trusted on its own; it is
    only used as a fast-path ("the gateway already told us the user
    cancelled, don't bother re-verifying"). The actual pass/fail decision
    always comes from provider.verify(), an independent server-to-server
    call to the gateway using our own stored authority and amount.

    Raises Transaction.DoesNotExist if the authority doesn't match any
    Transaction — the view turns that into a 404.

    Idempotent and atomic: a Transaction already in a terminal state
    (Success or Failed) is returned as-is without calling the gateway or
    touching anything else, so a duplicate/replayed callback (the user
    refreshing the result page, or the gateway retrying) can never create a
    second UserSubscription or flip a Failed transaction back to Success.
    Marking Success and calling activate_subscription() happen inside one
    atomic block with the row locked (select_for_update): if activation
    raises for any reason, the entire block rolls back and the Transaction
    is left exactly as it was — never Success with a NULL user_subscription.
    """
    provider = provider or get_payment_provider()

    with db_transaction.atomic():
        txn = (
            Transaction.objects.select_for_update()
            .select_related('plan', 'user')
            .get(gateway_reference_id=authority)
        )

        if txn.status in (Transaction.Status.SUCCESS, Transaction.Status.FAILED):
            return txn

        if gateway_reported_status != 'OK':
            txn.status = Transaction.Status.FAILED
            txn.verified_at = timezone.now()
            txn.save(update_fields=['status', 'verified_at'])
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
        # gateway_reference_id deliberately keeps the authority (not
        # result.ref_id) — it's the lookup key above, so overwriting it
        # would break idempotency on a second callback hit.
        txn.save(update_fields=['status', 'verified_at', 'user_subscription'])

    return txn
