from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
User = get_user_model()

class TicketPermissionTests(APITestCase):
    def test_ticket_is_visible_only_to_owner_or_staff(self):
        owner = User.objects.create_user(email="owner@example.com", password="StrongPass!42", display_name="Owner")
        stranger = User.objects.create_user(email="stranger@example.com", password="StrongPass!42", display_name="Stranger")
        self.client.force_authenticate(owner)
        created = self.client.post("/api/tickets/", {"subject":"Help", "priority":"normal", "message":"Please help"}, format="json")
        self.client.force_authenticate(stranger); self.assertEqual(self.client.get(f"/api/tickets/{created.data['id']}/").status_code, 403)
