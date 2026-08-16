from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.subscriptions import services as subscription_services
from apps.subscriptions.models import SubscriptionPlan, UserSubscription
from apps.users.models import User

from .models import Playlist


def make_user(suffix):
    return User.objects.create(
        email=f'{suffix}@example.com',
        display_name=suffix,
        username=suffix,
    )


def create_playlists(owner, count):
    Playlist.objects.bulk_create(
        [Playlist(title=f'{owner.username}-pl-{i}', owner=owner) for i in range(count)]
    )


class PlaylistCreationLimitTests(APITestCase):
    def setUp(self):
        self.basic = SubscriptionPlan.objects.get(tier=SubscriptionPlan.Tier.BASIC)
        self.silver = SubscriptionPlan.objects.get(tier=SubscriptionPlan.Tier.SILVER)
        self.gold = SubscriptionPlan.objects.get(tier=SubscriptionPlan.Tier.GOLD)
        self.today = timezone.localdate()

    def _create(self, user, title='New playlist'):
        return self.client.post(
            reverse('playlist-list'),
            {'title': title, 'ownerId': user.id},
            format='json',
        )

    def test_basic_user_can_create_playlists_until_the_limit(self):
        user = make_user('pl_basic_ok')
        create_playlists(user, self.basic.playlist_limit - 1)
        response = self._create(user)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Playlist.objects.filter(owner=user).count(), self.basic.playlist_limit)

    def test_basic_user_is_rejected_after_reaching_the_limit(self):
        user = make_user('pl_basic_full')
        create_playlists(user, self.basic.playlist_limit)
        response = self._create(user)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Playlist.objects.filter(owner=user).count(), self.basic.playlist_limit)

    def test_silver_user_can_create_below_its_limit(self):
        user = make_user('pl_silver_ok')
        subscription_services.activate_subscription(user, self.silver, 1)
        create_playlists(user, self.silver.playlist_limit - 1)
        response = self._create(user)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_silver_user_is_rejected_at_its_own_limit(self):
        user = make_user('pl_silver_full')
        subscription_services.activate_subscription(user, self.silver, 1)
        create_playlists(user, self.silver.playlist_limit)
        response = self._create(user)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_gold_user_is_unlimited(self):
        user = make_user('pl_gold')
        subscription_services.activate_subscription(user, self.gold, 1)
        create_playlists(user, 500)
        response = self._create(user)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_expired_paid_subscription_falls_back_to_basic_restrictions(self):
        user = make_user('pl_expired')
        UserSubscription.objects.create(
            user=user,
            plan=self.silver,
            start_date=self.today - timedelta(days=60),
            end_date=self.today - timedelta(days=1),
            status=UserSubscription.Status.ACTIVE,
        )
        create_playlists(user, self.basic.playlist_limit)
        response = self._create(user)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_future_subscription_does_not_grant_privileges_early(self):
        user = make_user('pl_future')
        UserSubscription.objects.create(
            user=user,
            plan=self.gold,
            start_date=self.today + timedelta(days=10),
            end_date=self.today + timedelta(days=40),
            status=UserSubscription.Status.ACTIVE,
        )
        create_playlists(user, self.basic.playlist_limit)
        response = self._create(user)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
