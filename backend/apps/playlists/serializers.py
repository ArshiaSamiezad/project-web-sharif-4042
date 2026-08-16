from django.db import transaction
from django.db.models import Max
from rest_framework import serializers

from apps.catalog.models import Track
from apps.catalog.serializers import cover_url
from apps.common.fields import AbsoluteImageField
from apps.common.uploads import validate_image_file
from apps.users.models import User

from .models import Playlist, PlaylistTrack


class PlaylistSerializer(serializers.ModelSerializer):
    ownerId = serializers.PrimaryKeyRelatedField(
        source='owner',
        queryset=User.objects.all(),
    )
    cover = AbsoluteImageField(required=False, allow_null=True, validators=[validate_image_file])
    trackIds = serializers.SerializerMethodField()

    class Meta:
        model = Playlist
        fields = ('id', 'title', 'ownerId', 'cover', 'trackIds')
        read_only_fields = ('id', 'trackIds')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance is not None:
            self.fields['ownerId'].read_only = True

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['cover'] = cover_url(
            instance.cover,
            'playlist',
            instance.pk,
            self.context.get('request'),
        )
        return data

    def get_trackIds(self, obj):
        return list(
            obj.playlist_tracks.order_by('position', 'id').values_list('track_id', flat=True)
        )

    def validate_title(self, value):
        title = str(value or '').strip()
        if not title:
            raise serializers.ValidationError('title is required.')
        return title


class PlaylistTrackWriteSerializer(serializers.Serializer):
    trackId = serializers.PrimaryKeyRelatedField(queryset=Track.objects.all())

    def create(self, validated_data):
        playlist = self.context['playlist']
        track = validated_data['trackId']

        if PlaylistTrack.objects.filter(playlist=playlist, track=track).exists():
            raise serializers.ValidationError({'trackId': 'Track is already in this playlist.'})

        with transaction.atomic():
            max_pos = (
                PlaylistTrack.objects.filter(playlist=playlist)
                .aggregate(max_pos=Max('position'))
                .get('max_pos')
            )
            position = 0 if max_pos is None else max_pos + 1
            entry = PlaylistTrack.objects.create(
                playlist=playlist,
                track=track,
                position=position,
            )
        return entry
