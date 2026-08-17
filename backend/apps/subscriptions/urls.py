from django.urls import path

from .views import (
    CurrentSubscriptionView,
    MockGatewayPageView,
    PaymentCallbackView,
    PurchaseView,
    ReportsOverviewView,
    SubscriptionHistoryView,
    SubscriptionPlanListView,
)

urlpatterns = [
    path('subscriptions/plans/', SubscriptionPlanListView.as_view(), name='subscription-plans'),
    path('subscriptions/current/', CurrentSubscriptionView.as_view(), name='subscription-current'),
    path('subscriptions/history/', SubscriptionHistoryView.as_view(), name='subscription-history'),
    path('subscriptions/purchase/', PurchaseView.as_view(), name='subscription-purchase'),
    path(
        'subscriptions/payments/callback/',
        PaymentCallbackView.as_view(),
        name='subscription-payment-callback',
    ),
    path(
        'subscriptions/payments/mock-gateway/',
        MockGatewayPageView.as_view(),
        name='subscription-mock-gateway',
    ),
    path(
        'subscriptions/reports/overview/',
        ReportsOverviewView.as_view(),
        name='subscription-reports-overview',
    ),
]
