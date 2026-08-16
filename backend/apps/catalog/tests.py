import io
from datetime import date

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from apps.playlists.models import Playlist, PlaylistTrack
from apps.subscriptions import services as subscription_services
from apps.subscriptions.models import SubscriptionPlan
from apps.users.models import User

from .models import Album, Track


def make_user(suffix, role=User.Role.LISTENER):
    return User.objects.create(
        email=f'{suffix}@example.com',
        display_name=suffix,
        username=suffix,
        role=role,
    )


def make_album(artist, title, early_access):
    return Album.objects.create(
        title=title,
        artist=artist,
        released_at=date(2026, 1, 1),
        genre='Pop',
        early_access=early_access,
    )


def make_track(artist, title, early_access):
    return Track.objects.create(
        title=title,
        artist=artist,
        released_at=date(2026, 1, 1),
        genre='Pop',
        early_access=early_access,
    )


def make_image(name='cover.png', size=(16, 16), color=(30, 80, 120)):
    buffer = io.BytesIO()
    Image.new('RGB', size, color=color).save(buffer, format='PNG')
    return SimpleUploadedFile(name, buffer.getvalue(), content_type='image/png')


def make_audio(name='song.mp3', payload=b'ID3demo-audio'):
    return SimpleUploadedFile(name, payload, content_type='audio/mpeg')


class EarlyAccessAlbumFilteringTests(APITestCase):
    def setUp(self):
        self.gold = SubscriptionPlan.objects.get(tier=SubscriptionPlan.Tier.GOLD)
        self.artist = make_user('ea_artist', role=User.Role.ARTIST)
        self.public_album = make_album(self.artist, 'Public Album', early_access=False)
        self.early_album = make_album(self.artist, 'Early Album', early_access=True)

    def test_ineligible_plan_does_not_see_early_access_album_in_list(self):
        viewer = make_user('ea_basic_viewer')
        response = self.client.get(reverse('album-list'), {'userId': viewer.id})
        ids = [item['id'] for item in response.data['results']]
        self.assertIn(self.public_album.id, ids)
        self.assertNotIn(self.early_album.id, ids)

    def test_gold_plan_sees_early_access_album_in_list(self):
        viewer = make_user('ea_gold_viewer')
        subscription_services.activate_subscription(viewer, self.gold, 1)
        response = self.client.get(reverse('album-list'), {'userId': viewer.id})
        ids = [item['id'] for item in response.data['results']]
        self.assertIn(self.early_album.id, ids)

    def test_ineligible_plan_gets_404_on_direct_retrieve(self):
        viewer = make_user('ea_basic_direct')
        response = self.client.get(
            reverse('album-detail', args=[self.early_album.id]), {'userId': viewer.id}
        )
        self.assertEqual(response.status_code, 404)

    def test_gold_plan_can_retrieve_directly(self):
        viewer = make_user('ea_gold_direct')
        subscription_services.activate_subscription(viewer, self.gold, 1)
        response = self.client.get(
            reverse('album-detail', args=[self.early_album.id]), {'userId': viewer.id}
        )
        self.assertEqual(response.status_code, 200)

    def test_omitting_user_id_keeps_existing_public_behavior(self):
        response = self.client.get(reverse('album-list'))
        ids = [item['id'] for item in response.data['results']]
        self.assertIn(self.early_album.id, ids)


class EarlyAccessTrackFilteringTests(APITestCase):
    def setUp(self):
        self.gold = SubscriptionPlan.objects.get(tier=SubscriptionPlan.Tier.GOLD)
        self.artist = make_user('ea_track_artist', role=User.Role.ARTIST)
        self.early_track = make_track(self.artist, 'Early Track', early_access=True)

    def test_ineligible_plan_does_not_see_early_access_track_in_list(self):
        viewer = make_user('ea_track_basic')
        response = self.client.get(reverse('track-list'), {'userId': viewer.id})
        ids = [item['id'] for item in response.data['results']]
        self.assertNotIn(self.early_track.id, ids)

    def test_gold_plan_sees_early_access_track_in_list(self):
        viewer = make_user('ea_track_gold')
        subscription_services.activate_subscription(viewer, self.gold, 1)
        response = self.client.get(reverse('track-list'), {'userId': viewer.id})
        ids = [item['id'] for item in response.data['results']]
        self.assertIn(self.early_track.id, ids)


class BackendFeatureTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.artist = User.objects.create(
            email='artist@test.local',
            display_name='Artist',
            username='artist_test',
            role=User.Role.ARTIST,
            artist_name='Artist',
            status=User.Status.APPROVED,
        )
        cls.listener = User.objects.create(
            email='listener@test.local',
            display_name='Listener',
            username='listener_test',
            role=User.Role.LISTENER,
        )

    def setUp(self):
        from pathlib import Path
        import tempfile

        self._media = tempfile.TemporaryDirectory()
        self.override = override_settings(MEDIA_ROOT=Path(self._media.name))
        self.override.enable()
        self.addCleanup(self.override.disable)
        self.addCleanup(self._media.cleanup)

    def test_01_album_rest_crud(self):
        create_res = self.client.post(
            '/api/albums/',
            {
                'title': 'Ocean',
                'artistId': self.artist.id,
                'releasedAt': '2026-06-01',
                'genre': 'electronic',
                'earlyAccess': False,
                'collaborators': ['Studio'],
            },
            format='json',
        )
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        album_id = create_res.data['id']
        self.assertEqual(create_res.data['title'], 'Ocean')
        self.assertEqual(create_res.data['artistId'], self.artist.id)
        self.assertTrue(str(create_res.data['cover']).startswith('https://picsum.photos/'))

        list_res = self.client.get('/api/albums/')
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(list_res.data['count'], 1)

        detail_res = self.client.get(f'/api/albums/{album_id}/')
        self.assertEqual(detail_res.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_res.data['genre'], 'electronic')

        patch_res = self.client.patch(
            f'/api/albums/{album_id}/',
            {'title': 'Ocean Remix', 'cover': make_image('album.png')},
            format='multipart',
        )
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_res.data['title'], 'Ocean Remix')
        self.assertTrue(str(patch_res.data['cover']).startswith('/media/covers/albums/'))

        delete_res = self.client.delete(f'/api/albums/{album_id}/')
        self.assertEqual(delete_res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Album.objects.filter(id=album_id).exists())

    def test_02_track_upload_audio_and_cover(self):
        res = self.client.post(
            '/api/tracks/',
            {
                'title': 'First Wave',
                'artistId': self.artist.id,
                'releasedAt': '2026-06-01',
                'genre': 'ambient',
                'earlyAccess': False,
                'lyrics': 'hello',
                'collaborators': '[]',
                'audioFile': make_audio(),
                'cover': make_image('track.png'),
            },
            format='multipart',
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data['title'], 'First Wave')
        self.assertTrue(str(res.data['audioUrl']).startswith('/media/audio/'))
        self.assertTrue(str(res.data['cover']).startswith('/media/covers/tracks/'))
        self.assertEqual(res.data['audio']['name'], 'song.mp3')
        self.assertEqual(res.data['audio']['type'], 'audio/mpeg')

        track = Track.objects.get(id=res.data['id'])
        self.assertTrue(bool(track.audio_file))
        self.assertTrue(bool(track.cover))
        self.assertGreater(track.audio_size, 0)

    def test_03_playlist_crud_and_track_membership(self):
        track_res = self.client.post(
            '/api/tracks/',
            {
                'title': 'Playlist Track',
                'artistId': self.artist.id,
                'releasedAt': '2026-07-01',
                'genre': 'pop',
                'audioFile': make_audio('pl.mp3'),
            },
            format='multipart',
        )
        self.assertEqual(track_res.status_code, status.HTTP_201_CREATED, track_res.data)
        track_id = track_res.data['id']

        create_res = self.client.post(
            '/api/playlists/',
            {
                'title': 'Night Drive',
                'ownerId': self.listener.id,
                'cover': make_image('playlist.png'),
            },
            format='multipart',
        )
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED, create_res.data)
        playlist_id = create_res.data['id']
        self.assertEqual(create_res.data['trackIds'], [])
        self.assertTrue(str(create_res.data['cover']).startswith('/media/covers/playlists/'))

        add_res = self.client.post(
            f'/api/playlists/{playlist_id}/tracks/',
            {'trackId': track_id},
            format='json',
        )
        self.assertEqual(add_res.status_code, status.HTTP_201_CREATED, add_res.data)
        self.assertEqual(add_res.data['trackIds'], [track_id])
        self.assertTrue(
            PlaylistTrack.objects.filter(playlist_id=playlist_id, track_id=track_id).exists()
        )

        rename_res = self.client.patch(
            f'/api/playlists/{playlist_id}/',
            {'title': 'Night Drive Vol.2'},
            format='json',
        )
        self.assertEqual(rename_res.status_code, status.HTTP_200_OK)
        self.assertEqual(rename_res.data['title'], 'Night Drive Vol.2')

        remove_res = self.client.delete(f'/api/playlists/{playlist_id}/tracks/{track_id}/')
        self.assertEqual(remove_res.status_code, status.HTTP_200_OK)
        self.assertEqual(remove_res.data['trackIds'], [])

        delete_res = self.client.delete(f'/api/playlists/{playlist_id}/')
        self.assertEqual(delete_res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Playlist.objects.filter(id=playlist_id).exists())

    def test_04_invalid_media_uploads_are_rejected(self):
        bad_audio = self.client.post(
            '/api/tracks/',
            {
                'title': 'Bad Audio',
                'artistId': self.artist.id,
                'releasedAt': '2026-08-01',
                'genre': 'test',
                'audioFile': SimpleUploadedFile(
                    'notes.txt',
                    b'not-audio',
                    content_type='text/plain',
                ),
            },
            format='multipart',
        )
        self.assertEqual(bad_audio.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('audioFile', bad_audio.data)

        bad_cover = self.client.post(
            '/api/albums/',
            {
                'title': 'Bad Cover',
                'artistId': self.artist.id,
                'releasedAt': '2026-08-01',
                'genre': 'test',
                'cover': SimpleUploadedFile(
                    'doc.pdf',
                    b'%PDF-fake',
                    content_type='application/pdf',
                ),
            },
            format='multipart',
        )
        self.assertEqual(bad_cover.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cover', bad_cover.data)

        missing_audio = self.client.post(
            '/api/tracks/',
            {
                'title': 'No Audio',
                'artistId': self.artist.id,
                'releasedAt': '2026-08-01',
                'genre': 'test',
            },
            format='json',
        )
        self.assertEqual(missing_audio.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('audioFile', missing_audio.data)

    def test_05_users_avatar_upload_and_album_track_relation(self):
        users_res = self.client.get('/api/users/')
        self.assertEqual(users_res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(users_res.data), 2)

        # Phase 6 gates avatar upload behind SubscriptionPlan.can_upload_profile_photo,
        # and self.listener defaults to Basic (which doesn't grant it) — grant a paid
        # plan here so this test keeps exercising the upload flow itself, exactly as
        # it did before that restriction existed. Plan-based rejection has its own
        # dedicated coverage in apps/users/tests.py.
        gold = SubscriptionPlan.objects.get(tier=SubscriptionPlan.Tier.GOLD)
        subscription_services.activate_subscription(self.listener, gold, 1)

        avatar_res = self.client.patch(
            f'/api/users/{self.listener.id}/',
            {'avatar': make_image('avatar.png')},
            format='multipart',
        )
        self.assertEqual(avatar_res.status_code, status.HTTP_200_OK, avatar_res.data)
        self.assertTrue(str(avatar_res.data['avatar']).startswith('/media/avatars/'))

        album_res = self.client.post(
            '/api/albums/',
            {
                'title': 'Linked Album',
                'artistId': self.artist.id,
                'releasedAt': '2026-09-01',
                'genre': 'indie',
                'cover': make_image('linked-album.png'),
            },
            format='multipart',
        )
        self.assertEqual(album_res.status_code, status.HTTP_201_CREATED, album_res.data)
        album_id = album_res.data['id']

        track_res = self.client.post(
            f'/api/albums/{album_id}/tracks/',
            {
                'title': 'Linked Track',
                'lyrics': 'verse',
                'audioFile': make_audio('linked.mp3'),
            },
            format='multipart',
        )
        self.assertEqual(track_res.status_code, status.HTTP_201_CREATED, track_res.data)
        self.assertEqual(track_res.data['albumId'], album_id)
        self.assertEqual(track_res.data['artistId'], self.artist.id)
        self.assertTrue(str(track_res.data['audioUrl']).startswith('/media/audio/'))

        detail = self.client.get(f'/api/albums/{album_id}/')
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data['trackIds'], [track_res.data['id']])
