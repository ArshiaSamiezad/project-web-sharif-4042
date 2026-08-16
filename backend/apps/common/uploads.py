from pathlib import Path
from uuid import uuid4

from django.core.exceptions import ValidationError


IMAGE_CONTENT_TYPES = {
    'image/jpeg',
    'image/jpg',
    'image/png',
}
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png'}

AUDIO_CONTENT_TYPES = {
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/flac',
    'audio/x-flac',
}
AUDIO_EXTENSIONS = {'.mp3', '.wav', '.flac'}


def _extension(filename):
    return Path(filename or '').suffix.lower()


def validate_image_file(file_obj):
    content_type = getattr(file_obj, 'content_type', '') or ''
    ext = _extension(getattr(file_obj, 'name', ''))
    if content_type not in IMAGE_CONTENT_TYPES and ext not in IMAGE_EXTENSIONS:
        raise ValidationError('Cover must be a JPEG or PNG image.')
    return file_obj


def validate_audio_file(file_obj):
    content_type = getattr(file_obj, 'content_type', '') or ''
    ext = _extension(getattr(file_obj, 'name', ''))
    if content_type not in AUDIO_CONTENT_TYPES and ext not in AUDIO_EXTENSIONS:
        raise ValidationError('Audio must be MP3, WAV, or FLAC.')
    return file_obj


def _unique_name(filename):
    ext = _extension(filename) or '.bin'
    return f'{uuid4().hex}{ext}'


def user_avatar_upload_to(instance, filename):
    return f'avatars/{instance.id or "new"}/{_unique_name(filename)}'


def album_cover_upload_to(instance, filename):
    artist_id = getattr(instance, 'artist_id', None) or 'unknown'
    return f'covers/albums/{artist_id}/{_unique_name(filename)}'


def track_cover_upload_to(instance, filename):
    artist_id = getattr(instance, 'artist_id', None) or 'unknown'
    return f'covers/tracks/{artist_id}/{_unique_name(filename)}'


def playlist_cover_upload_to(instance, filename):
    owner_id = getattr(instance, 'owner_id', None) or 'unknown'
    return f'covers/playlists/{owner_id}/{_unique_name(filename)}'


def track_audio_upload_to(instance, filename):
    artist_id = getattr(instance, 'artist_id', None) or 'unknown'
    return f'audio/{artist_id}/{_unique_name(filename)}'
