from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AlbumViewSet, TrackViewSet

router = DefaultRouter()
router.register('albums', AlbumViewSet, basename='album')
router.register('tracks', TrackViewSet, basename='track')

urlpatterns = [
    path('', include(router.urls)),
]
