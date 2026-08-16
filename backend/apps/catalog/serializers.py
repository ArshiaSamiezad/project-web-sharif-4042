from rest_framework import serializers

from apps.users.models import User

from .models import Album, Track


def parse_collaborators(value):
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    return [
        part.strip()
        for part in str(value).replace('،', ',').split(',')
        if part.strip()
    ]


def default_cover(prefix, object_id):
    return f'https://picsum.photos/seed/sepatify-{prefix}-{object_id}/400/400'


class AudioField(serializers.Field):
    def get_attribute(self, instance):
        return instance

    def to_representation(self, track):
        if not track.audio_name:
            return None
        return {
            'name': track.audio_name,
            'size': track.audio_size,
            'type': track.audio_type,
        }

    def to_internal_value(self, data):
        if data is None:
            return None
        if not isinstance(data, dict):
            raise serializers.ValidationError('audio must be an object.')
        name = str(data.get('name') or '').strip()
        if not name:
            raise serializers.ValidationError('audio.name is required.')
        return {
            'audio_name': name,
            'audio_size': int(data.get('size') or 0),
            'audio_type': str(data.get('type') or ''),
        }


class AlbumSerializer(serializers.ModelSerializer):
    artistId = serializers.PrimaryKeyRelatedField(
        source='artist',
        queryset=User.objects.all(),
    )
    artistName = serializers.SerializerMethodField()
    releasedAt = serializers.DateField(source='released_at')
    earlyAccess = serializers.BooleanField(source='early_access', required=False, default=False)
    trackIds = serializers.SerializerMethodField()

    class Meta:
        model = Album
        fields = (
            'id',
            'title',
            'artistId',
            'artistName',
            'cover',
            'releasedAt',
            'listeners',
            'earlyAccess',
            'genre',
            'collaborators',
            'trackIds',
        )
        read_only_fields = ('id', 'listeners', 'artistName', 'trackIds')

    def get_artistName(self, obj):
        return obj.artist.public_artist_name

    def get_trackIds(self, obj):
        return list(obj.tracks.order_by('id').values_list('id', flat=True))

    def validate_collaborators(self, value):
        return parse_collaborators(value)

    def validate_title(self, value):
        title = str(value or '').strip()
        if not title:
            raise serializers.ValidationError('title is required.')
        return title

    def validate_genre(self, value):
        genre = str(value or '').strip()
        if not genre:
            raise serializers.ValidationError('genre is required.')
        return genre

    def create(self, validated_data):
        album = Album.objects.create(**validated_data)
        if not album.cover:
            album.cover = default_cover('album', album.id)
            album.save(update_fields=['cover'])
        return album


class TrackSerializer(serializers.ModelSerializer):
    artistId = serializers.PrimaryKeyRelatedField(
        source='artist',
        queryset=User.objects.all(),
    )
    artistName = serializers.SerializerMethodField()
    albumId = serializers.PrimaryKeyRelatedField(
        source='album',
        queryset=Album.objects.all(),
        allow_null=True,
        required=False,
        default=None,
    )
    releasedAt = serializers.DateField(source='released_at')
    earlyAccess = serializers.BooleanField(source='early_access', required=False, default=False)
    audioUrl = serializers.URLField(source='audio_url', required=False, allow_blank=True, default='')
    audio = AudioField(required=False, allow_null=True)
    coverImage = serializers.SerializerMethodField()

    class Meta:
        model = Track
        fields = (
            'id',
            'title',
            'artistId',
            'artistName',
            'albumId',
            'cover',
            'coverImage',
            'plays',
            'listeners',
            'releasedAt',
            'earlyAccess',
            'genre',
            'collaborators',
            'lyrics',
            'audio',
            'audioUrl',
        )
        read_only_fields = ('id', 'plays', 'listeners', 'artistName', 'coverImage')

    def get_artistName(self, obj):
        return obj.artist.public_artist_name

    def get_coverImage(self, obj):
        return obj.cover

    def validate_collaborators(self, value):
        return parse_collaborators(value)

    def validate_title(self, value):
        title = str(value or '').strip()
        if not title:
            raise serializers.ValidationError('title is required.')
        return title

    def validate_genre(self, value):
        genre = str(value or '').strip()
        if not genre:
            raise serializers.ValidationError('genre is required.')
        return genre

    def validate(self, attrs):
        album = attrs.get('album', serializers.empty)
        artist = attrs.get('artist', serializers.empty)

        if self.instance is not None:
            if album is serializers.empty:
                album = self.instance.album
            if artist is serializers.empty:
                artist = self.instance.artist

        if album is not None and album is not serializers.empty and artist is not serializers.empty:
            if album.artist_id != artist.id:
                raise serializers.ValidationError(
                    {'albumId': 'Album must belong to the same artist.'}
                )

        audio = attrs.get('audio', serializers.empty)
        if self.instance is None and (audio is serializers.empty or not audio):
            raise serializers.ValidationError({'audio': 'audio is required.'})
        if audio is None and 'audio' in getattr(self, 'initial_data', {}):
            raise serializers.ValidationError({'audio': 'audio is required.'})

        return attrs

    def _apply_audio(self, validated_data):
        audio = validated_data.pop('audio', serializers.empty)
        if audio is serializers.empty:
            return validated_data
        if audio is None:
            validated_data.update(
                {
                    'audio_name': '',
                    'audio_size': 0,
                    'audio_type': '',
                }
            )
        else:
            validated_data.update(audio)
        return validated_data

    def create(self, validated_data):
        validated_data = self._apply_audio(validated_data)
        track = Track.objects.create(**validated_data)
        if not track.cover:
            if track.album_id and track.album.cover:
                track.cover = track.album.cover
            else:
                track.cover = default_cover('track', track.id)
            track.save(update_fields=['cover'])
        return track

    def update(self, instance, validated_data):
        validated_data = self._apply_audio(validated_data)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance
