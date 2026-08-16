from django.contrib import admin

from .models import SubscriptionPlan, Transaction, UserSubscription


@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'tier',
        'name',
        'price_1_month',
        'price_3_months',
        'price_6_months',
        'price_12_months',
        'is_active',
    )
    list_filter = ('tier', 'is_active')
    search_fields = ('name',)


@admin.register(UserSubscription)
class UserSubscriptionAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'plan', 'start_date', 'end_date', 'status')
    list_filter = ('status', 'plan')
    search_fields = ('user__username', 'user__email')


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'user',
        'plan_tier_snapshot',
        'duration_months',
        'amount',
        'status',
        'created_at',
    )
    list_filter = ('status', 'plan_tier_snapshot')
    search_fields = ('user__username', 'user__email', 'gateway_reference_id')
