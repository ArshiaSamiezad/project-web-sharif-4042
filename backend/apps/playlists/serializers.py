from django.db import transaction
from django.db.models import Max
from rest_framework import serializers

from apps.catalog.models import Track
from apps.catalog.serializers import default_cover
from apps.users.models import User

from .models import Playlist, PlaylistTrack


class PlaylistSerializer(serializers.ModelSerializer):
    ownerId = serializers.PrimaryKeyRelatedField(
        source='owner',
        queryset=User.objects.all(),
    )
    trackIds = serializers.SerializerMethodField()

    class Meta:
        model = Playlist
        fields = ('id', 'title', 'ownerId', 'cover', 'trackIds')
        read_only_fields = ('id', 'trackIds')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance is not None:
            self.fields['ownerId'].read_only = True

    def get_trackIds(self, obj):
        return list(
            obj.playlist_tracks.order_by('position', 'id').values_list('track_id', flat=True)
        )

    def validate_title(self, value):
        title = str(value or '').strip()
        if not title:
            raise serializers.ValidationError('title is required.')
        return title

    def create(self, validated_data):
        playlist = Playlist.objects.create(**validated_data)
        if not playlist.cover:
            playlist.cover = default_cover('playlist', playlist.id)
            playlist.save(update_fields=['cover'])
        return playlist


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
