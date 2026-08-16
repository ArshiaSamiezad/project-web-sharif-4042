from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import ArtistVerification, User, UserPreference

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (("Sepatify", {"fields": ("display_name", "role", "subscription", "birth_date", "gender", "avatar_url", "bio", "artist_name")}),)
    add_fieldsets = UserAdmin.add_fieldsets + (("Sepatify", {"fields": ("email", "display_name", "role")}),)
    list_display = ("email", "username", "display_name", "role", "subscription", "is_active")
admin.site.register(UserPreference)
admin.site.register(ArtistVerification)
