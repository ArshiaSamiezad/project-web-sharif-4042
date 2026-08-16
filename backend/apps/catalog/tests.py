from datetime import date

from django.urls import reverse
from rest_framework.test import APITestCase

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
