from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import (ArtistRegisterView, ListenerRegisterView, LogoutView, MeView, PasswordResetConfirmView,
    PasswordResetRequestView, PreferenceView, VerificationListView, VerificationReviewView)

urlpatterns = [
    path("register/listener/", ListenerRegisterView.as_view()), path("register/artist/", ArtistRegisterView.as_view()),
    path("login/", TokenObtainPairView.as_view()), path("refresh/", TokenRefreshView.as_view()), path("logout/", LogoutView.as_view()),
    path("password-reset/", PasswordResetRequestView.as_view()), path("password-reset/confirm/", PasswordResetConfirmView.as_view()),
    path("me/", MeView.as_view()), path("preferences/", PreferenceView.as_view()),
    path("artist-verifications/", VerificationListView.as_view()), path("artist-verifications/<int:pk>/", VerificationReviewView.as_view()),
]
