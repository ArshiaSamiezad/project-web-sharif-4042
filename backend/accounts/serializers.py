from django.contrib.auth.password_validation import validate_password
from django.core.validators import URLValidator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers
from apps.users.models import User as CatalogUser
from .models import ArtistVerification, User, UserPreference


def validate_avatar_reference(value):
    """Accept either a public URL or a media path returned by the upload API."""
    if not value or value.startswith("/media/"):
        return value
    try:
        URLValidator(schemes=["http", "https"])(value)
    except DjangoValidationError as exc:
        raise serializers.ValidationError("Enter a valid URL.") from exc
    return value


def sync_catalog_user(user, status=None):
    verification = getattr(user, "artist_verification", None)
    if status is None:
        status = verification.status if verification else ""
    catalog_role = "artist" if status else user.role
    CatalogUser.objects.update_or_create(
        email=user.email,
        defaults={
            "display_name": user.display_name,
            "username": user.username,
            "role": catalog_role,
            "artist_name": user.artist_name or (verification.artist_name if verification else ""),
            "status": status,
            "subscription": user.subscription,
        },
    )


class UserSerializer(serializers.ModelSerializer):
    displayName = serializers.CharField(source="display_name")
    birthDate = serializers.DateField(source="birth_date", allow_null=True, required=False)
    # Uploaded catalog images are represented as same-origin /media/... paths,
    # while users may also paste a full external URL in the profile form.
    avatar = serializers.CharField(
        source="avatar_url",
        allow_blank=True,
        required=False,
        validators=[validate_avatar_reference],
    )
    status = serializers.SerializerMethodField()
    class Meta:
        model = User
        fields = ("id", "email", "username", "displayName", "role", "subscription", "birthDate", "gender", "avatar", "bio", "artist_name", "status")
        read_only_fields = ("id", "email", "role", "subscription", "status")
    def get_status(self, obj):
        verification = getattr(obj, "artist_verification", None)
        return verification.status if verification else "approved"

    def update(self, instance, validated_data):
        user = super().update(instance, validated_data)
        sync_catalog_user(user)
        return user

class ListenerRegistrationSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    confirmPassword = serializers.CharField(write_only=True)
    displayName = serializers.CharField(max_length=100)
    birthDate = serializers.DateField()
    gender = serializers.ChoiceField(choices=["female", "male", "other", "unspecified"])
    acceptedPrivacy = serializers.BooleanField()
    def validate(self, attrs):
        if attrs["password"] != attrs["confirmPassword"]:
            raise serializers.ValidationError({"confirmPassword": "Passwords do not match."})
        if not attrs["acceptedPrivacy"]:
            raise serializers.ValidationError({"acceptedPrivacy": "Privacy policy acceptance is required."})
        try: validate_password(attrs["password"])
        except DjangoValidationError as exc: raise serializers.ValidationError({"password": list(exc.messages)}) from exc
        return attrs
    def create(self, data):
        user = User.objects.create_user(email=data["email"], password=data["password"], display_name=data["displayName"], birth_date=data["birthDate"], gender=data["gender"])
        sync_catalog_user(user)
        return user

class ArtistRegistrationSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    confirmPassword = serializers.CharField(write_only=True)
    artistName = serializers.CharField(max_length=120)
    samples = serializers.ListField(child=serializers.CharField(max_length=500), min_length=1)
    def validate(self, attrs):
        if attrs["password"] != attrs["confirmPassword"]:
            raise serializers.ValidationError({"confirmPassword": "Passwords do not match."})
        try: validate_password(attrs["password"])
        except DjangoValidationError as exc: raise serializers.ValidationError({"password": list(exc.messages)}) from exc
        return attrs
    @transaction.atomic
    def create(self, data):
        user = User.objects.create_user(email=data["email"], password=data["password"], display_name=data["artistName"])
        verification = ArtistVerification.objects.create(applicant=user, artist_name=data["artistName"], sample_links=data["samples"])
        sync_catalog_user(user, verification.status)
        return user

class PreferenceSerializer(serializers.ModelSerializer):
    explicitContent = serializers.BooleanField(source="explicit_content")
    emailNotifications = serializers.BooleanField(source="email_notifications")
    class Meta:
        model = UserPreference
        fields = ("theme", "language", "autoplay", "explicitContent", "emailNotifications", "updated_at")
        read_only_fields = ("updated_at",)

class VerificationSerializer(serializers.ModelSerializer):
    applicant = UserSerializer(read_only=True)
    class Meta:
        model = ArtistVerification
        fields = ("id", "applicant", "artist_name", "sample_links", "status", "review_note", "reviewed_by", "created_at", "reviewed_at")
        read_only_fields = fields

class VerificationReviewSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[ArtistVerification.Status.APPROVED, ArtistVerification.Status.REJECTED])
    review_note = serializers.CharField(required=False, allow_blank=True, max_length=2000)

class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(write_only=True)
    def validate_password(self, value):
        try: validate_password(value)
        except DjangoValidationError as exc: raise serializers.ValidationError(list(exc.messages)) from exc
        return value
