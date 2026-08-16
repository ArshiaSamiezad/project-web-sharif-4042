from django.contrib.auth.models import AbstractUser, UserManager as DjangoUserManager
from django.db import models

class UserManager(DjangoUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        extra_fields.setdefault("username", self._unique_username(email))
        return super().create_user(extra_fields.pop("username"), email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.update(is_staff=True, is_superuser=True, role=User.Role.ADMIN)
        return self.create_user(email, password, **extra_fields)

    def _unique_username(self, email):
        base = email.split("@", 1)[0].lower()[:20] or "user"
        candidate, index = base, 1
        while self.model.objects.filter(username=candidate).exists():
            index += 1
            candidate = f"{base[:16]}_{index}"
        return candidate

class User(AbstractUser):
    class Role(models.TextChoices):
        LISTENER = "listener", "Listener"
        ARTIST = "artist", "Artist"
        SUPPORT = "support", "Support"
        ADMIN = "admin", "Admin"
    class Subscription(models.TextChoices):
        BASIC = "basic", "Basic"
        SILVER = "silver", "Silver"
        GOLD = "gold", "Gold"
    email = models.EmailField(unique=True)
    display_name = models.CharField(max_length=100)
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.LISTENER, db_index=True)
    subscription = models.CharField(max_length=12, choices=Subscription.choices, default=Subscription.BASIC)
    birth_date = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=20, blank=True)
    avatar_url = models.URLField(blank=True)
    bio = models.TextField(blank=True)
    artist_name = models.CharField(max_length=120, blank=True)
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["display_name"]
    objects = UserManager()

class UserPreference(models.Model):
    class Theme(models.TextChoices):
        SYSTEM = "system", "System"
        LIGHT = "light", "Light"
        DARK = "dark", "Dark"
    class Language(models.TextChoices):
        FA = "fa", "Persian"
        EN = "en", "English"
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="preferences")
    theme = models.CharField(max_length=10, choices=Theme.choices, default=Theme.SYSTEM)
    language = models.CharField(max_length=5, choices=Language.choices, default=Language.FA)
    autoplay = models.BooleanField(default=True)
    explicit_content = models.BooleanField(default=False)
    email_notifications = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

class ArtistVerification(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
    applicant = models.OneToOneField(User, on_delete=models.CASCADE, related_name="artist_verification")
    artist_name = models.CharField(max_length=120)
    sample_links = models.JSONField(default=list)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING, db_index=True)
    reviewed_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="reviewed_artists")
    review_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
