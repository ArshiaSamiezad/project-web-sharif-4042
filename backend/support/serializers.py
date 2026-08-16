from rest_framework import serializers
from .models import Ticket, TicketMessage

class TicketMessageSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.display_name", read_only=True)
    class Meta:
        model = TicketMessage
        fields = ("id", "author", "author_name", "body", "created_at")
        read_only_fields = ("id", "author", "author_name", "created_at")

class TicketSerializer(serializers.ModelSerializer):
    messages = TicketMessageSerializer(many=True, read_only=True)
    message = serializers.CharField(write_only=True, required=True)
    class Meta:
        model = Ticket
        fields = ("id", "owner", "subject", "status", "priority", "assigned_to", "messages", "message", "created_at", "updated_at")
        read_only_fields = ("id", "owner", "status", "assigned_to", "messages", "created_at", "updated_at")
    def create(self, data):
        body = data.pop("message"); ticket = Ticket.objects.create(owner=self.context["request"].user, **data)
        TicketMessage.objects.create(ticket=ticket, author=ticket.owner, body=body)
        return ticket

class TicketUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ticket
        fields = ("status", "priority", "assigned_to")

class MessageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketMessage
        fields = ("body",)
