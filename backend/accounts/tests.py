from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from apps.users.models import User as CatalogUser
from .models import ArtistVerification

User = get_user_model()

class CoreAuthTests(APITestCase):
    def test_listener_registration_hashes_password_and_forces_role(self):
        response = self.client.post("/api/auth/register/listener/", {"email":"new@example.com","password":"StrongPass!42","confirmPassword":"StrongPass!42","displayName":"New","birthDate":"2000-01-01","gender":"other","acceptedPrivacy":True,"role":"admin"}, format="json")
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(email="new@example.com")
        self.assertTrue(user.check_password("StrongPass!42")); self.assertEqual(user.role, User.Role.LISTENER)
        self.assertTrue(CatalogUser.objects.filter(email="new@example.com").exists())

    def test_login_returns_tokens_and_me(self):
        User.objects.create_user(email="user@example.com", password="StrongPass!42", display_name="User")
        response = self.client.post("/api/auth/login/", {"email":"user@example.com","password":"StrongPass!42"}, format="json")
        self.assertEqual(response.status_code, 200); self.assertIn("access", response.data)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 200)

    def test_profile_cannot_escalate_role_or_subscription(self):
        user = User.objects.create_user(email="user@example.com", password="StrongPass!42", display_name="User")
        self.client.force_authenticate(user)
        response = self.client.patch("/api/auth/me/", {"role":"admin","subscription":"gold","displayName":"Changed"}, format="json")
        user.refresh_from_db(); self.assertEqual(response.status_code, 200)
        self.assertEqual(user.role, User.Role.LISTENER); self.assertEqual(user.subscription, User.Subscription.BASIC)

    def test_profile_accepts_uploaded_avatar_media_path(self):
        user = User.objects.create_user(email="avatar@example.com", password="StrongPass!42", display_name="Avatar")
        self.client.force_authenticate(user)

        response = self.client.patch(
            "/api/auth/me/",
            {"avatar": "/media/avatars/uploaded.png"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertEqual(user.avatar_url, "/media/avatars/uploaded.png")
        self.assertEqual(response.data["avatar"], "/media/avatars/uploaded.png")

    def test_profile_rejects_invalid_non_media_avatar_reference(self):
        user = User.objects.create_user(email="bad-avatar@example.com", password="StrongPass!42", display_name="Avatar")
        self.client.force_authenticate(user)

        response = self.client.patch(
            "/api/auth/me/",
            {"avatar": "/somewhere/else.png"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_support_can_approve_artist_and_listener_cannot(self):
        applicant = User.objects.create_user(email="artist@example.com", password="StrongPass!42", display_name="Artist")
        item = ArtistVerification.objects.create(applicant=applicant, artist_name="Stage", sample_links=["https://example.com/demo"])
        listener = User.objects.create_user(email="listener@example.com", password="StrongPass!42", display_name="Listener")
        self.client.force_authenticate(listener); self.assertEqual(self.client.patch(f"/api/auth/artist-verifications/{item.pk}/", {"status":"approved"}, format="json").status_code, 403)
        support = User.objects.create_user(email="support@example.com", password="StrongPass!42", display_name="Support", role=User.Role.SUPPORT)
        self.client.force_authenticate(support); self.assertEqual(self.client.patch(f"/api/auth/artist-verifications/{item.pk}/", {"status":"approved"}, format="json").status_code, 200)
        applicant.refresh_from_db(); self.assertEqual(applicant.role, User.Role.ARTIST)

    def test_preferences_are_private_and_persist(self):
        first = User.objects.create_user(email="one@example.com", password="StrongPass!42", display_name="One")
        second = User.objects.create_user(email="two@example.com", password="StrongPass!42", display_name="Two")
        self.client.force_authenticate(first); self.client.patch("/api/auth/preferences/", {"theme":"dark","language":"en","autoplay":False,"explicitContent":True,"emailNotifications":False}, format="json")
        self.client.force_authenticate(second); self.assertEqual(self.client.get("/api/auth/preferences/").data["theme"], "system")
        self.client.force_authenticate(first); self.assertEqual(self.client.get("/api/auth/preferences/").data["theme"], "dark")

    def test_deleting_account_removes_catalog_profile(self):
        user = User.objects.create_user(email="delete@example.com", password="StrongPass!42", display_name="Delete")
        CatalogUser.objects.create(email=user.email, display_name="Delete", username=user.username)
        self.client.force_authenticate(user)
        self.assertEqual(self.client.delete("/api/auth/me/").status_code, 204)
        self.assertFalse(User.objects.filter(pk=user.pk).exists())
        self.assertFalse(CatalogUser.objects.filter(email=user.email).exists())
