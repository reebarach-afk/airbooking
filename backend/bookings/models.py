import secrets
import string

from django.conf import settings
from django.db import models

from flights.models import Flight


def generate_booking_ref():
    alphabet = string.ascii_uppercase + string.digits
    return "AB" + "".join(secrets.choice(alphabet) for _ in range(6))


class Booking(models.Model):
    class Status(models.TextChoices):
        CONFIRMED = "confirmed", "Confirmed"
        CANCELLED = "cancelled", "Cancelled"

    class PaymentStatus(models.TextChoices):
        PAID = "paid", "Paid"
        REFUNDED = "refunded", "Refunded"

    booking_ref = models.CharField(max_length=10, unique=True, default=generate_booking_ref, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="bookings")
    flight = models.ForeignKey(Flight, on_delete=models.PROTECT, related_name="bookings")
    seats = models.PositiveSmallIntegerField()
    passengers = models.JSONField(default=list)
    total_price = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.CONFIRMED, db_index=True)
    payment_status = models.CharField(max_length=10, choices=PaymentStatus.choices, default=PaymentStatus.PAID)
    payment_method = models.CharField(max_length=20)
    payment_reference = models.CharField(max_length=30, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(condition=models.Q(seats__gte=1), name="booking_seats_positive"),
        ]

    def __str__(self):
        return f"{self.booking_ref} ({self.user})"
