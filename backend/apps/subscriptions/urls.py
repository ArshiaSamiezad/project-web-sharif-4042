from django.urls import path

from .views import (
    CurrentSubscriptionView,
    PurchaseView,
    ReportsOverviewView,
    SubscriptionHistoryView,
    SubscriptionPlanListView,
    VerifyTransactionView,
)

urlpatterns = [
    path('subscriptions/plans/', SubscriptionPlanListView.as_view(), name='subscription-plans'),
    path('subscriptions/current/', CurrentSubscriptionView.as_view(), name='subscription-current'),
    path('subscriptions/history/', SubscriptionHistoryView.as_view(), name='subscription-history'),
    path('subscriptions/purchase/', PurchaseView.as_view(), name='subscription-purchase'),
    path('subscriptions/verify/', VerifyTransactionView.as_view(), name='subscription-verify'),
    path(
        'subscriptions/reports/overview/',
        ReportsOverviewView.as_view(),
        name='subscription-reports-overview',
    ),
]
