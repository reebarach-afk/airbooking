from rest_framework import filters, generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminUser

from .filters import FlightFilter, upcoming
from .models import Airport, Flight
from .serializers import (
    AdminFlightSerializer, AirportSerializer, FlightSerializer, FlightStatusSerializer,
)
from .services.live_status import get_live_status


class AirportListView(generics.ListAPIView):
    queryset = Airport.objects.all()
    serializer_class = AirportSerializer
    pagination_class = None
    filterset_class = None


class FlightSearchView(generics.ListAPIView):
    """GET /api/flights/search/?origin=COK&destination=DEL&date=2026-12-01&available_only=true"""

    serializer_class = FlightSerializer
    filterset_class = FlightFilter
    filter_backends = [*generics.ListAPIView.filter_backends, filters.OrderingFilter]
    ordering_fields = ["departure_time", "price", "arrival_time"]
    ordering = ["departure_time"]

    def get_queryset(self):
        return upcoming(Flight.objects.select_related("origin", "destination"))


class FlightDetailView(generics.RetrieveAPIView):
    serializer_class = FlightSerializer
    queryset = Flight.objects.select_related("origin", "destination")


class FlightLiveStatusView(APIView):
    def get(self, request, pk):
        try:
            flight = Flight.objects.get(pk=pk)
        except Flight.DoesNotExist:
            return Response({"detail": "Flight not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(get_live_status(flight))


# ------------------------------------------------------------------ admin API
class AdminFlightViewSet(viewsets.ModelViewSet):
    """CRUD for flights at /api/admin/flights/, status at /api/admin/flights/{id}/status/."""

    serializer_class = AdminFlightSerializer
    permission_classes = [IsAdminUser]
    queryset = Flight.objects.select_related("origin", "destination").order_by("-departure_time")
    filterset_class = FlightFilter

    def destroy(self, request, *args, **kwargs):
        flight = self.get_object()
        if flight.bookings.filter(status="confirmed").exists():
            return Response(
                {"detail": "This flight has confirmed bookings. Cancel the flight instead of deleting it."},
                status=status.HTTP_409_CONFLICT,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["put"], url_path="status")
    def set_status(self, request, pk=None):
        flight = self.get_object()
        serializer = FlightStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        flight.status = serializer.validated_data["status"]
        flight.delay_minutes = serializer.validated_data["delay_minutes"]
        flight.save(update_fields=["status", "delay_minutes", "updated_at"])
        return Response(AdminFlightSerializer(flight).data)
