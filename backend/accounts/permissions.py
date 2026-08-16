from rest_framework.permissions import BasePermission

class IsSupportOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and request.user.role in {"support", "admin"})

class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and request.user.role == "admin")

class IsOwner(BasePermission):
    def has_object_permission(self, request, view, obj):
        owner = getattr(obj, "user", getattr(obj, "owner", obj))
        return owner == request.user

class HasSubscription(BasePermission):
    required_subscription = "basic"
    levels = {"basic": 0, "silver": 1, "gold": 2}
    def has_permission(self, request, view):
        required = getattr(view, "required_subscription", self.required_subscription)
        return self.levels.get(request.user.subscription, 0) >= self.levels[required]
