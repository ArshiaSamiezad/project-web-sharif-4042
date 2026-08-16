from rest_framework import serializers

from apps.common.fields import AbsoluteImageField
from apps.common.uploads import validate_audio_file, validate_image_file
from apps.users.models import User

from .models import Album, Track


def parse_collaborators(value):
    if value is None:
        return []
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return []
        try:
            import json

            return parse_collaborators(json.loads(raw))
        except json.JSONDecodeError:
            return [
                part.strip()
                for part in raw.replace('،', ',').split(',')
                if part.strip()
            ]
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    text = str(value).strip()
    return [text] if text else []


def media_url(file_field, request):
    if not file_field:
        return ''
    url = file_field.url
    if request is not None:
        return request.build_absolute_uri(url)
    return url


class AlbumSerializer(serializers.ModelSerializer):
    artistId = serializers.PrimaryKeyRelatedField(
        source='artist',
        queryset=User.objects.all(),
    )
    artistName = serializers.SerializerMethodField()
    releasedAt = serializers.DateField(source='released_at')
    earlyAccess = serializers.BooleanField(source='early_access', required=False, default=False)
    cover = AbsoluteImageField(required=False, allow_null=True, validators=[validate_image_file])
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
    cover = AbsoluteImageField(required=False, allow_null=True, validators=[validate_image_file])
    coverImage = serializers.SerializerMethodField()
    audio = serializers.SerializerMethodField()
    audioFile = serializers.FileField(
        source='audio_file',
        required=False,
        allow_null=True,
        write_only=True,
        validators=[validate_audio_file],
    )
    audioUrl = serializers.SerializerMethodField()

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
            'audioFile',
            'audioUrl',
        )
        read_only_fields = (
            'id',
            'plays',
            'listeners',
            'artistName',
            'coverImage',
            'audio',
            'audioUrl',
        )

    def get_artistName(self, obj):
        return obj.artist.public_artist_name

    def get_coverImage(self, obj):
        return media_url(obj.cover, self.context.get('request'))

    def get_audio(self, obj):
        if not obj.audio_name and not obj.audio_file:
            return None
        name = obj.audio_name
        if not name and obj.audio_file:
            name = obj.audio_file.name.rsplit('/', 1)[-1]
        return {
            'name': name,
            'size': obj.audio_size or getattr(obj.audio_file, 'size', 0) or 0,
            'type': obj.audio_type or '',
        }

    def get_audioUrl(self, obj):
        if obj.audio_file:
            return media_url(obj.audio_file, self.context.get('request'))
        return obj.external_audio_url or ''

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

        audio_file = attrs.get('audio_file', serializers.empty)
        if self.instance is None and (audio_file is serializers.empty or not audio_file):
            raise serializers.ValidationError({'audioFile': 'audioFile is required.'})

        return attrs

    def create(self, validated_data):
        audio = validated_data.get('audio_file')
        track = Track(**validated_data)
        if audio:
            track.audio_name = getattr(audio, 'name', '') or ''
            track.audio_size = getattr(audio, 'size', 0) or 0
            track.audio_type = getattr(audio, 'content_type', '') or ''
        if not track.cover and track.album_id and track.album.cover:
            track.cover = track.album.cover
        track.save()
        return track

    def update(self, instance, validated_data):
        audio = validated_data.get('audio_file', serializers.empty)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if audio is not serializers.empty and audio:
            instance.audio_name = getattr(audio, 'name', '') or ''
            instance.audio_size = getattr(audio, 'size', 0) or 0
            instance.audio_type = getattr(audio, 'content_type', '') or ''
        instance.save()
        return instance
