from decimal import Decimal

from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import APIException

from flights.models import Flight

from .models import Booking
from .payment import process_payment


class PaymentFailed(APIException):
    status_code = 402
    default_detail = "Payment failed."
    default_code = "payment_failed"


def create_booking(user, flight, passengers, payment):
    seats = len(passengers)
    total = (flight.price * Decimal(seats)).quantize(Decimal("0.01"))

    with transaction.atomic():
        result = process_payment(
            payment["method"], total,
            card_number=payment.get("card_number", ""), upi_id=payment.get("upi_id", ""),
        )
        if not result.success:
            raise PaymentFailed(result.message)

        # Atomic conditional UPDATE: only succeeds while enough seats remain, so two
        # simultaneous requests can never oversell the last seats (works on every DB).
        reserved = Flight.objects.filter(
            pk=flight.pk, available_seats__gte=seats
        ).exclude(status=Flight.Status.CANCELLED).update(available_seats=F("available_seats") - seats)
        if not reserved:
            left = Flight.objects.values_list("available_seats", flat=True).get(pk=flight.pk)
            raise serializers.ValidationError(
                {"passengers": f"Only {left} seat(s) left on this flight." if left else "This flight is sold out."}
            )

        return Booking.objects.create(
            user=user, flight=flight, seats=seats, passengers=passengers, total_price=total,
            payment_method=payment["method"], payment_reference=result.reference,
        )


def cancel_booking(booking_id, user):
    with transaction.atomic():
        booking = Booking.objects.select_for_update().select_related("flight").get(pk=booking_id, user=user)
        if booking.status == Booking.Status.CANCELLED:
            raise serializers.ValidationError("This booking is already cancelled.")
        if booking.flight.departure_time <= timezone.now():
            raise serializers.ValidationError("Departed flights cannot be cancelled.")
        booking.status = Booking.Status.CANCELLED
        booking.payment_status = Booking.PaymentStatus.REFUNDED
        booking.cancelled_at = timezone.now()
        booking.save(update_fields=["status", "payment_status", "cancelled_at"])
        Flight.objects.filter(pk=booking.flight_id).update(available_seats=F("available_seats") + booking.seats)
    booking.refresh_from_db()
    return booking
