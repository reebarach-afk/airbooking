from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, Sum
from django.db.models.functions import TruncDate
from django.http import Http404
from django.utils import timezone
from rest_framework import generics, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminUser
from flights.models import Flight

from .models import Booking
from .serializers import (
    AdminBookingSerializer, BookingCreateSerializer, BookingSerializer,
)
from .services import cancel_booking, create_booking

User = get_user_model()


class BookingViewSet(
    mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """/api/bookings/ - always scoped to the requesting user (no IDOR)."""

    throttle_scope = "booking"
    filterset_fields = ["status"]

    def get_queryset(self):
        qs = Booking.objects.filter(user=self.request.user).select_related("flight__origin", "flight__destination")
        if self.request.query_params.get("upcoming") == "true":
            qs = qs.filter(flight__departure_time__gt=timezone.now(), status=Booking.Status.CONFIRMED)
        return qs

    def get_serializer_class(self):
        return BookingCreateSerializer if self.action == "create" else BookingSerializer

    def create(self, request, *args, **kwargs):
        serializer = BookingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        booking = create_booking(request.user, data["flight"], data["passengers"], data["payment"])
        booking = self.get_queryset().get(pk=booking.pk)
        return Response(BookingSerializer(booking).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        if not self.get_queryset().filter(pk=pk).exists():
            raise Http404
        booking = cancel_booking(pk, request.user)
        booking = self.get_queryset().get(pk=booking.pk)
        return Response(BookingSerializer(booking).data)


# ------------------------------------------------------------------ admin API
class AdminBookingListView(generics.ListAPIView):
    serializer_class = AdminBookingSerializer
    permission_classes = [IsAdminUser]
    filterset_fields = ["status", "flight"]
    queryset = Booking.objects.select_related("user", "flight__origin", "flight__destination")


class AdminStatsView(APIView):
    """Dashboard numbers: users, flights, bookings, revenue, occupancy, top routes."""

    permission_classes = [IsAdminUser]

    def get(self, request):
        confirmed = Booking.objects.filter(status=Booking.Status.CONFIRMED)
        agg = confirmed.aggregate(revenue=Sum("total_price"), seats=Sum("seats"), count=Count("id"))
        active = Flight.objects.exclude(status=Flight.Status.CANCELLED).aggregate(
            capacity=Sum("total_seats"), free=Sum("available_seats")
        )
        capacity, free = active["capacity"] or 0, active["free"] or 0
        occupancy = round((capacity - free) / capacity * 100, 2) if capacity else 0

        users = {r["approval_status"]: r["n"] for r in User.objects.values("approval_status").annotate(n=Count("id"))}
        flights = {r["status"]: r["n"] for r in Flight.objects.values("status").annotate(n=Count("id"))}

        since = timezone.now() - timedelta(days=6)
        per_day = {
            str(r["d"]): r["n"]
            for r in confirmed.filter(created_at__date__gte=since.date())
            .annotate(d=TruncDate("created_at")).values("d").annotate(n=Count("id"))
        }
        last_7 = [
            {"date": str((since + timedelta(days=i)).date()), "bookings": per_day.get(str((since + timedelta(days=i)).date()), 0)}
            for i in range(7)
        ]
        top_routes = [
            {"route": f'{r["flight__origin__code"]} → {r["flight__destination__code"]}', "bookings": r["n"], "seats": r["s"]}
            for r in confirmed.values("flight__origin__code", "flight__destination__code")
            .annotate(n=Count("id"), s=Sum("seats")).order_by("-n")[:5]
        ]
        return Response(
            {
                "users": {
                    "pending": users.get("pending", 0),
                    "approved": users.get("approved", 0),
                    "rejected": users.get("rejected", 0),
                },
                "flights": {
                    "total": sum(flights.values()),
                    "on_time": flights.get("on_time", 0),
                    "delayed": flights.get("delayed", 0),
                    "cancelled": flights.get("cancelled", 0),
                },
                "bookings": {
                    "confirmed": agg["count"] or 0,
                    "cancelled": Booking.objects.filter(status=Booking.Status.CANCELLED).count(),
                    "seats_sold": agg["seats"] or 0,
                    "revenue": str(agg["revenue"] or 0),
                },
                "occupancy_percent": occupancy,
                "bookings_last_7_days": last_7,
                "top_routes": top_routes,
            }
        )
