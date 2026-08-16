from django.urls import path

from .views import CurrentSubscriptionView, SubscriptionHistoryView, SubscriptionPlanListView

urlpatterns = [
    path('subscriptions/plans/', SubscriptionPlanListView.as_view(), name='subscription-plans'),
    path('subscriptions/current/', CurrentSubscriptionView.as_view(), name='subscription-current'),
    path('subscriptions/history/', SubscriptionHistoryView.as_view(), name='subscription-history'),
]
