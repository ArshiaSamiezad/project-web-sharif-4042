from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.subscriptions import access
from apps.users.models import User

from .models import Album, Track
from .serializers import AlbumSerializer, TrackSerializer


def _apply_early_access_filter(queryset, request):
    """
    Optional viewer-scoped filtering, mirroring the project's existing
    explicit-id convention (ownerId/artistId): pass ?userId=<id> to have
    early-access items excluded when that user's effective plan doesn't
    include early access.

    Fails open (no filtering) when userId is absent, malformed, or doesn't
    match a real user — this endpoint had no viewer-identification concept
    before Phase 6, so existing callers that never send userId keep today's
    fully-public behavior unchanged.
    """
    raw_user_id = request.query_params.get('userId')
    if not raw_user_id:
        return queryset
    try:
        user_id = int(raw_user_id)
    except (TypeError, ValueError):
        return queryset
    user = User.objects.filter(pk=user_id).first()
    if user is None:
        return queryset
    plan = access.get_user_effective_plan(user)
    if plan.has_early_access:
        return queryset
    return queryset.filter(early_access=False)


class AlbumViewSet(viewsets.ModelViewSet):
    queryset = Album.objects.select_related('artist').prefetch_related('tracks')
    serializer_class = AlbumSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        queryset = super().get_queryset()
        artist_id = self.request.query_params.get('artistId')
        if artist_id:
            queryset = queryset.filter(artist_id=artist_id)
        queryset = _apply_early_access_filter(queryset, self.request)
        return queryset

    def perform_destroy(self, instance):
        Track.objects.filter(album=instance).delete()
        instance.delete()

    @action(detail=True, methods=['post'], url_path='tracks')
    def add_track(self, request, pk=None):
        album = self.get_object()
        data = request.data.copy()
        data['albumId'] = album.id
        data['artistId'] = album.artist_id
        if 'releasedAt' not in data:
            data['releasedAt'] = album.released_at.isoformat()
        if 'genre' not in data:
            data['genre'] = album.genre
        if 'earlyAccess' not in data:
            data['earlyAccess'] = album.early_access

        serializer = TrackSerializer(data=data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            track = serializer.save()
        return Response(
            TrackSerializer(track, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )


class TrackViewSet(viewsets.ModelViewSet):
    queryset = Track.objects.select_related('artist', 'album')
    serializer_class = TrackSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
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

        queryset = _apply_early_access_filter(queryset, self.request)
        return queryset
