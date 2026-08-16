from rest_framework import serializers

from .models import SubscriptionPlan, Transaction, UserSubscription


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    price1Month = serializers.IntegerField(source='price_1_month', read_only=True)
    price3Months = serializers.IntegerField(source='price_3_months', read_only=True)
    price6Months = serializers.IntegerField(source='price_6_months', read_only=True)
    price12Months = serializers.IntegerField(source='price_12_months', read_only=True)
    # daily_stream_limit / playlist_limit stay None in the response when unlimited
    # (DRF represents a None attribute as JSON null regardless of field type).
    dailyStreamLimit = serializers.IntegerField(source='daily_stream_limit', read_only=True)
    playlistLimit = serializers.IntegerField(source='playlist_limit', read_only=True)
    canDownload = serializers.BooleanField(source='can_download', read_only=True)
    canUploadProfilePhoto = serializers.BooleanField(source='can_upload_profile_photo', read_only=True)
    hasEarlyAccess = serializers.BooleanField(source='has_early_access', read_only=True)
    hasStatsAccess = serializers.BooleanField(source='has_stats_access', read_only=True)

    class Meta:
        model = SubscriptionPlan
        fields = (
            'id',
            'tier',
            'name',
            'price1Month',
            'price3Months',
            'price6Months',
            'price12Months',
            'dailyStreamLimit',
            'playlistLimit',
            'canDownload',
            'canUploadProfilePhoto',
            'hasEarlyAccess',
            'hasStatsAccess',
        )
        read_only_fields = fields


class UserSubscriptionHistorySerializer(serializers.ModelSerializer):
    plan = SubscriptionPlanSerializer(read_only=True)
    planTier = serializers.CharField(source='plan.tier', read_only=True)
    startDate = serializers.DateField(source='start_date', read_only=True)
    endDate = serializers.DateField(source='end_date', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = UserSubscription
        fields = ('id', 'plan', 'planTier', 'startDate', 'endDate', 'status', 'createdAt')
        read_only_fields = fields


class TransactionSerializer(serializers.ModelSerializer):
    transactionId = serializers.IntegerField(source='id', read_only=True)
    planTierSnapshot = serializers.CharField(source='plan_tier_snapshot', read_only=True)
    durationMonths = serializers.IntegerField(source='duration_months', read_only=True)
    gatewayReferenceId = serializers.CharField(source='gateway_reference_id', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    verifiedAt = serializers.DateTimeField(source='verified_at', read_only=True)
    userSubscription = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = (
            'transactionId',
            'status',
            'amount',
            'planTierSnapshot',
            'durationMonths',
            'gatewayReferenceId',
            'createdAt',
            'verifiedAt',
            'userSubscription',
        )
        read_only_fields = fields

    def get_userSubscription(self, obj):
        if obj.user_subscription_id is None:
            return None
        return UserSubscriptionHistorySerializer(obj.user_subscription).data


class CurrentSubscriptionSerializer(serializers.Serializer):
    """
    Response shape for GET current/. Not a ModelSerializer: it combines a
    User, the user's effective SubscriptionPlan (possibly the Basic
    fallback, which has no UserSubscription row), and the effective
    UserSubscription itself when one exists.

    Expects `instance` to be a dict: {'user': User, 'plan': SubscriptionPlan,
    'subscription': UserSubscription | None}.
    """

    userId = serializers.SerializerMethodField()
    tier = serializers.SerializerMethodField()
    plan = serializers.SerializerMethodField()
    startDate = serializers.SerializerMethodField()
    endDate = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    def get_userId(self, obj):
        return obj['user'].id

    def get_tier(self, obj):
        return obj['plan'].tier

    def get_plan(self, obj):
        return SubscriptionPlanSerializer(obj['plan']).data

    def get_startDate(self, obj):
        subscription = obj['subscription']
        return subscription.start_date if subscription else None

    def get_endDate(self, obj):
        subscription = obj['subscription']
        return subscription.end_date if subscription else None

    def get_status(self, obj):
        subscription = obj['subscription']
        return subscription.status if subscription else None
