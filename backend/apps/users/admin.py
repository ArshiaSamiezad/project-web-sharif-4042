from django.contrib import admin

from .models import User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('id', 'username', 'email', 'role', 'subscription', 'status')
    list_filter = ('role', 'subscription', 'status')
    search_fields = ('username', 'email', 'display_name', 'artist_name')
