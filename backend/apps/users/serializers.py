from rest_framework import serializers

from apps.common.fields import AbsoluteImageField
from apps.common.uploads import validate_image_file
from apps.subscriptions import access

from .models import User


class UserSerializer(serializers.ModelSerializer):
    displayName = serializers.CharField(source='display_name')
    artistName = serializers.CharField(source='artist_name', required=False, allow_blank=True)
    avatar = AbsoluteImageField(required=False, allow_null=True, validators=[validate_image_file])

    class Meta:
        model = User
        fields = (
            'id',
            'email',
            'displayName',
            'username',
            'role',
            'artistName',
            'status',
            'subscription',
            'avatar',
        )
        read_only_fields = ('id',)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance is not None:
            for name in (
                'email',
                'displayName',
                'username',
                'role',
                'artistName',
                'status',
                'subscription',
            ):
                self.fields[name].read_only = True

    def validate_avatar(self, value):
        # Only gate an actual new upload — submitting avatar=null to remove
        # a photo, or not submitting avatar at all, is never restricted.
        if not value:
            return value
        if self.instance is not None:
            access.ensure_profile_photo_upload_allowed(self.instance)
        else:
            # POST /api/users/ (create): no persisted user yet to resolve a
            # plan for. A brand-new user has no UserSubscription row by
            # definition, so their effective plan is always Basic.
            access.ensure_new_user_profile_photo_upload_allowed()
        return value
