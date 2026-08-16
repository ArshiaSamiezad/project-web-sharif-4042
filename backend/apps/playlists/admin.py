from django.contrib import admin

from .models import Playlist, PlaylistTrack


class PlaylistTrackInline(admin.TabularInline):
    model = PlaylistTrack
    extra = 0


@admin.register(Playlist)
class PlaylistAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'owner', 'updated_at')
    search_fields = ('title', 'owner__username', 'owner__display_name')
    inlines = [PlaylistTrackInline]


@admin.register(PlaylistTrack)
class PlaylistTrackAdmin(admin.ModelAdmin):
    list_display = ('id', 'playlist', 'track', 'position')
    list_filter = ('playlist',)
