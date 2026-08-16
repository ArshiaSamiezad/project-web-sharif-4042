from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    displayName = serializers.CharField(source='display_name')
    artistName = serializers.CharField(source='artist_name')

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
        )
        read_only_fields = fields
