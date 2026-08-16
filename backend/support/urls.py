from django.urls import path
from .views import TicketDetailView, TicketListCreateView, TicketManageView, TicketMessageView
urlpatterns = [path("tickets/", TicketListCreateView.as_view()), path("tickets/<int:pk>/", TicketDetailView.as_view()),
               path("tickets/<int:pk>/manage/", TicketManageView.as_view()), path("tickets/<int:pk>/messages/", TicketMessageView.as_view())]
