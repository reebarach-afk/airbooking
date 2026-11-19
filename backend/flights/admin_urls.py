from django.urls import path
from rest_framework.routers import DefaultRouter

from bookings.views import AdminBookingListView, AdminStatsView

from .views import AdminFlightViewSet

router = DefaultRouter()
router.register("flights", AdminFlightViewSet, basename="admin-flights")

urlpatterns = [
    path("stats/", AdminStatsView.as_view(), name="admin-stats"),
    path("bookings/", AdminBookingListView.as_view(), name="admin-bookings"),
] + router.urls
