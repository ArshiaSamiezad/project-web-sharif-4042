from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Ticket, TicketMessage
from .permissions import CanAccessTicket
from .serializers import MessageCreateSerializer, TicketMessageSerializer, TicketSerializer, TicketUpdateSerializer

class TicketListCreateView(generics.ListCreateAPIView):
    serializer_class = TicketSerializer
    def get_queryset(self):
        qs = Ticket.objects.select_related("owner", "assigned_to").prefetch_related("messages__author").order_by("-updated_at")
        return qs if self.request.user.role in {"support", "admin"} else qs.filter(owner=self.request.user)

class TicketDetailView(generics.RetrieveAPIView):
    serializer_class = TicketSerializer
    permission_classes = [CanAccessTicket]
    queryset = Ticket.objects.select_related("owner", "assigned_to").prefetch_related("messages__author")

class TicketManageView(generics.UpdateAPIView):
    serializer_class = TicketUpdateSerializer
    permission_classes = [CanAccessTicket]
    queryset = Ticket.objects.all()
    def perform_update(self, serializer):
        if self.request.user.role not in {"support", "admin"}:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only support staff can manage tickets.")
        serializer.save()

class TicketMessageView(APIView):
    permission_classes = [CanAccessTicket]
    def post(self, request, pk):
        ticket = get_object_or_404(Ticket, pk=pk); self.check_object_permissions(request, ticket)
        serializer = MessageCreateSerializer(data=request.data); serializer.is_valid(raise_exception=True)
        message = TicketMessage.objects.create(ticket=ticket, author=request.user, **serializer.validated_data)
        return Response(TicketMessageSerializer(message).data, status=status.HTTP_201_CREATED)
