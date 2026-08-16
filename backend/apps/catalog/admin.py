from django.contrib import admin

from .models import Album, Track


@admin.register(Album)
class AlbumAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'artist', 'genre', 'released_at', 'early_access')
    list_filter = ('genre', 'early_access')
    search_fields = ('title', 'artist__display_name', 'artist__artist_name')


@admin.register(Track)
class TrackAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'artist', 'album', 'genre', 'plays', 'released_at')
    list_filter = ('genre', 'early_access')
    search_fields = ('title', 'artist__display_name', 'artist__artist_name')
