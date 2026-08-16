from django.db import models

from apps.catalog.models import Track
from apps.users.models import User


class Playlist(models.Model):
    title = models.CharField(max_length=200)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='playlists')
    cover = models.URLField(max_length=500, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at', '-id']

    def __str__(self):
        return self.title


class PlaylistTrack(models.Model):
    playlist = models.ForeignKey(
        Playlist,
        on_delete=models.CASCADE,
        related_name='playlist_tracks',
    )
    track = models.ForeignKey(
        Track,
        on_delete=models.CASCADE,
        related_name='playlist_entries',
    )
    position = models.PositiveIntegerField(default=0)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['position', 'id']
        constraints = [
            models.UniqueConstraint(
                fields=['playlist', 'track'],
                name='unique_track_per_playlist',
            ),
        ]

    def __str__(self):
        return f'{self.playlist_id}:{self.track_id}'
