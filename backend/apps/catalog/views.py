from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Album, Track
from .serializers import AlbumSerializer, TrackSerializer


class AlbumViewSet(viewsets.ModelViewSet):
    queryset = Album.objects.select_related('artist').prefetch_related('tracks')
    serializer_class = AlbumSerializer
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        queryset = super().get_queryset()
        artist_id = self.request.query_params.get('artistId')
        if artist_id:
            queryset = queryset.filter(artist_id=artist_id)
        return queryset

    def perform_destroy(self, instance):
        Track.objects.filter(album=instance).delete()
        instance.delete()

    @action(detail=True, methods=['post'], url_path='tracks')
    def add_track(self, request, pk=None):
        album = self.get_object()
        payload = request.data.copy()
        payload['albumId'] = album.id
        payload.setdefault('artistId', album.artist_id)
        payload.setdefault('releasedAt', album.released_at.isoformat())
        payload.setdefault('genre', album.genre)
        payload.setdefault('earlyAccess', album.early_access)
        payload.setdefault('cover', album.cover)

        serializer = TrackSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            track = serializer.save()
        return Response(TrackSerializer(track).data, status=status.HTTP_201_CREATED)


class TrackViewSet(viewsets.ModelViewSet):
    queryset = Track.objects.select_related('artist', 'album')
    serializer_class = TrackSerializer
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        queryset = super().get_queryset()
        artist_id = self.request.query_params.get('artistId')
        album_id = self.request.query_params.get('albumId')
        single = self.request.query_params.get('single')

        if artist_id:
            queryset = queryset.filter(artist_id=artist_id)
        if album_id:
            queryset = queryset.filter(album_id=album_id)
        if single is not None:
            flag = str(single).lower() in {'1', 'true', 'yes'}
            queryset = queryset.filter(album__isnull=flag)

        return queryset
