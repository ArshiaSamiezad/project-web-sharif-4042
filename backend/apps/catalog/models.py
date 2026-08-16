from django.db import models

from apps.common.uploads import (
    album_cover_upload_to,
    track_audio_upload_to,
    track_cover_upload_to,
    validate_audio_file,
    validate_image_file,
)
from apps.users.models import User


class Album(models.Model):
    title = models.CharField(max_length=200)
    artist = models.ForeignKey(User, on_delete=models.CASCADE, related_name='albums')
    cover = models.ImageField(
        upload_to=album_cover_upload_to,
        blank=True,
        null=True,
        validators=[validate_image_file],
    )
    released_at = models.DateField()
    listeners = models.PositiveIntegerField(default=0)
    early_access = models.BooleanField(default=False)
    genre = models.CharField(max_length=100)
    collaborators = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-released_at', '-id']

    def __str__(self):
        return self.title


class Track(models.Model):
    title = models.CharField(max_length=200)
    artist = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tracks')
    album = models.ForeignKey(
        Album,
        on_delete=models.CASCADE,
        related_name='tracks',
        null=True,
        blank=True,
    )
    cover = models.ImageField(
        upload_to=track_cover_upload_to,
        blank=True,
        null=True,
        validators=[validate_image_file],
    )
    plays = models.PositiveIntegerField(default=0)
    listeners = models.PositiveIntegerField(default=0)
    released_at = models.DateField()
    early_access = models.BooleanField(default=False)
    genre = models.CharField(max_length=100)
    collaborators = models.JSONField(default=list, blank=True)
    lyrics = models.TextField(blank=True, default='')
    audio_file = models.FileField(
        upload_to=track_audio_upload_to,
        blank=True,
        null=True,
        validators=[validate_audio_file],
    )
    external_audio_url = models.URLField(max_length=500, blank=True, default='')
    audio_name = models.CharField(max_length=255, blank=True, default='')
    audio_size = models.PositiveIntegerField(default=0)
    audio_type = models.CharField(max_length=100, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-released_at', '-id']

    def __str__(self):
        return self.title

    @property
    def is_single(self):
        return self.album_id is None

    def sync_audio_meta(self):
        if not self.audio_file:
            self.audio_name = ''
            self.audio_size = 0
            self.audio_type = ''
            return
        self.audio_name = self.audio_file.name.rsplit('/', 1)[-1]
        self.audio_size = getattr(self.audio_file, 'size', None) or self.audio_size or 0
        content_type = getattr(self.audio_file, 'content_type', '') or ''
        if content_type:
            self.audio_type = content_type
