from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.subscriptions import services as subscription_services
from apps.subscriptions.models import SubscriptionPlan

from .models import User

# A real 1x1 PNG (via Pillow) — Django's ImageField re-decodes the upload
# with Pillow to validate it, so hand-crafted/truncated bytes get rejected
# as "corrupted image" before our access check is ever reached.
TINY_PNG_BYTES = bytes.fromhex(
    '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de'
    '0000000c49444154789c63f8cfc0000003010100c9fe92ef0000000049454e44ae'
    '426082'
)


def make_user(suffix):
    return User.objects.create(
        email=f'{suffix}@example.com',
        display_name=suffix,
        username=suffix,
    )


def make_avatar_file(name='avatar.png'):
    return SimpleUploadedFile(name, TINY_PNG_BYTES, content_type='image/png')


class ProfilePhotoUploadAccessTests(APITestCase):
    def setUp(self):
        self.silver = SubscriptionPlan.objects.get(tier=SubscriptionPlan.Tier.SILVER)

    def test_basic_user_is_denied_avatar_upload(self):
        user = make_user('avatar_basic')
        response = self.client.patch(
            reverse('user-detail', args=[user.id]),
            {'avatar': make_avatar_file()},
            format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        user.refresh_from_db()
        self.assertFalse(user.avatar)

    def test_eligible_plan_can_upload_avatar(self):
        user = make_user('avatar_silver')
        subscription_services.activate_subscription(user, self.silver, 1)
        response = self.client.patch(
            reverse('user-detail', args=[user.id]),
            {'avatar': make_avatar_file()},
            format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertTrue(user.avatar)

    def test_unrelated_profile_updates_remain_allowed_for_basic_user(self):
        user = make_user('avatar_unrelated')
        response = self.client.patch(
            reverse('user-detail', args=[user.id]),
            {'displayName': 'New Display Name'},
            format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertEqual(user.display_name, 'New Display Name')

    def test_avatar_removal_is_not_gated_by_plan(self):
        # Removing a photo (avatar=null) is never restricted, even for
        # Basic — only submitting a new upload is gated.
        from .serializers import UserSerializer

        user = make_user('avatar_removal')
        user.avatar = make_avatar_file()
        user.save(update_fields=['avatar'])

        serializer = UserSerializer(user, data={'avatar': None}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
