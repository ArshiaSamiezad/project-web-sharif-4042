from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Playlist, PlaylistTrack
from .serializers import PlaylistSerializer, PlaylistTrackWriteSerializer


class PlaylistViewSet(viewsets.ModelViewSet):
    queryset = Playlist.objects.select_related('owner').prefetch_related('playlist_tracks')
    serializer_class = PlaylistSerializer
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        queryset = super().get_queryset()
        owner_id = self.request.query_params.get('ownerId')
        if owner_id:
            queryset = queryset.filter(owner_id=owner_id)
        return queryset

    @action(detail=True, methods=['post'], url_path='tracks')
    def add_track(self, request, pk=None):
        playlist = self.get_object()
        serializer = PlaylistTrackWriteSerializer(
            data=request.data,
            context={'playlist': playlist},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(PlaylistSerializer(playlist).data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=['delete'],
        url_path=r'tracks/(?P<track_id>[^/.]+)',
    )
    def remove_track(self, request, pk=None, track_id=None):
        playlist = self.get_object()
        deleted, _ = PlaylistTrack.objects.filter(
            playlist=playlist,
            track_id=track_id,
        ).delete()
        if not deleted:
            return Response(
                {'detail': 'Track not found in this playlist.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(PlaylistSerializer(playlist).data)
