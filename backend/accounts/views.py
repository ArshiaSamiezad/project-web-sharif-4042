from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from .models import ArtistVerification, UserPreference
from .permissions import IsSupportOrAdmin
from .serializers import (ArtistRegistrationSerializer, ListenerRegistrationSerializer, PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer, PreferenceSerializer, UserSerializer, VerificationReviewSerializer, VerificationSerializer)

User = get_user_model()

class ListenerRegisterView(generics.CreateAPIView):
    serializer_class = ListenerRegistrationSerializer
    permission_classes = [AllowAny]
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data); serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

class ArtistRegisterView(ListenerRegisterView):
    serializer_class = ArtistRegistrationSerializer

class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    def get_object(self): return self.request.user

class PreferenceView(generics.RetrieveUpdateAPIView):
    serializer_class = PreferenceSerializer
    def get_object(self): return UserPreference.objects.get_or_create(user=self.request.user)[0]

class LogoutView(APIView):
    def post(self, request):
        token = request.data.get("refresh")
        if not token: return Response({"refresh": ["This field is required."]}, status=400)
        try: RefreshToken(token).blacklist()
        except Exception: return Response({"refresh": ["Invalid token."]}, status=400)
        return Response(status=204)

class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data); serializer.is_valid(raise_exception=True)
        user = User.objects.filter(email__iexact=serializer.validated_data["email"], is_active=True).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk)); token = default_token_generator.make_token(user)
            link = f"{settings.FRONTEND_RESET_URL}?uid={uid}&token={token}"
            send_mail("Sepatify password reset", f"Reset your password: {link}", None, [user.email])
        return Response({"detail": "If the account exists, a reset link has been sent."})

class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data); serializer.is_valid(raise_exception=True)
        try: user = User.objects.get(pk=force_str(urlsafe_base64_decode(serializer.validated_data["uid"])))
        except (User.DoesNotExist, ValueError, TypeError, OverflowError): user = None
        if not user or not default_token_generator.check_token(user, serializer.validated_data["token"]):
            return Response({"token": ["Invalid or expired token."]}, status=400)
        user.set_password(serializer.validated_data["password"]); user.save(update_fields=["password"])
        return Response(status=204)

class VerificationListView(generics.ListAPIView):
    serializer_class = VerificationSerializer
    permission_classes = [IsSupportOrAdmin]
    queryset = ArtistVerification.objects.select_related("applicant", "reviewed_by").order_by("-created_at")

class VerificationReviewView(APIView):
    permission_classes = [IsSupportOrAdmin]
    @transaction.atomic
    def patch(self, request, pk):
        item = get_object_or_404(ArtistVerification.objects.select_for_update().select_related("applicant"), pk=pk)
        if item.status != ArtistVerification.Status.PENDING:
            return Response({"status": ["Verification has already been reviewed."]}, status=409)
        serializer = VerificationReviewSerializer(data=request.data); serializer.is_valid(raise_exception=True)
        item.status = serializer.validated_data["status"]; item.review_note = serializer.validated_data.get("review_note", "")
        item.reviewed_by = request.user; item.reviewed_at = timezone.now(); item.save()
        if item.status == ArtistVerification.Status.APPROVED:
            item.applicant.role = User.Role.ARTIST; item.applicant.artist_name = item.artist_name
            item.applicant.save(update_fields=["role", "artist_name"])
        return Response(VerificationSerializer(item).data)
