from django.db import models

from apps.common.uploads import user_avatar_upload_to, validate_image_file


class User(models.Model):
    class Role(models.TextChoices):
        LISTENER = 'listener', 'Listener'
        ARTIST = 'artist', 'Artist'
        SUPPORT = 'support', 'Support'
        ADMIN = 'admin', 'Admin'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'

    class Subscription(models.TextChoices):
        BASIC = 'basic', 'Basic'
        SILVER = 'silver', 'Silver'
        GOLD = 'gold', 'Gold'

    email = models.EmailField(unique=True)
    display_name = models.CharField(max_length=120)
    username = models.CharField(max_length=80, unique=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.LISTENER)
    artist_name = models.CharField(max_length=120, blank=True, default='')
    status = models.CharField(max_length=20, choices=Status.choices, blank=True, default='')
    subscription = models.CharField(
        max_length=20,
        choices=Subscription.choices,
        default=Subscription.BASIC,
    )
    avatar = models.ImageField(
        upload_to=user_avatar_upload_to,
        blank=True,
        null=True,
        validators=[validate_image_file],
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return self.display_name or self.username

    @property
    def public_artist_name(self):
        return self.artist_name or self.display_name
