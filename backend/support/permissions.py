from rest_framework.permissions import BasePermission

class CanAccessTicket(BasePermission):
    def has_object_permission(self, request, view, obj):
        ticket = getattr(obj, "ticket", obj)
        return ticket.owner == request.user or request.user.role in {"support", "admin"}
