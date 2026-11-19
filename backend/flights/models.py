from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import F, Q


class Airport(models.Model):
    code = models.CharField("IATA code", max_length=3, unique=True)
    name = models.CharField(max_length=120)
    city = models.CharField(max_length=80)
    country = models.CharField(max_length=60, default="India")

    class Meta:
        ordering = ["city"]

    def __str__(self):
        return f"{self.city} ({self.code})"


class Flight(models.Model):
    class Status(models.TextChoices):
        ON_TIME = "on_time", "On time"
        DELAYED = "delayed", "Delayed"
        CANCELLED = "cancelled", "Cancelled"

    flight_number = models.CharField(max_length=10, db_index=True)
    airline = models.CharField(max_length=60)
    origin = models.ForeignKey(Airport, on_delete=models.PROTECT, related_name="departures")
    destination = models.ForeignKey(Airport, on_delete=models.PROTECT, related_name="arrivals")
    departure_time = models.DateTimeField(db_index=True)
    arrival_time = models.DateTimeField()
    price = models.DecimalField(max_digits=9, decimal_places=2)
    total_seats = models.PositiveIntegerField(default=180)
    available_seats = models.PositiveIntegerField(default=180)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ON_TIME)
    delay_minutes = models.PositiveIntegerField(default=0)
    aircraft = models.CharField(max_length=40, blank=True)
    # Optional hex transponder code - lets OpenSky track the real aircraft.
    icao24 = models.CharField("ICAO24 (OpenSky)", max_length=6, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["departure_time"]
        constraints = [
            models.CheckConstraint(condition=~Q(origin=F("destination")), name="flight_origin_ne_destination"),
            models.CheckConstraint(condition=Q(arrival_time__gt=F("departure_time")), name="flight_arrival_after_departure"),
            models.CheckConstraint(condition=Q(available_seats__lte=F("total_seats")), name="flight_available_lte_total"),
        ]

    def __str__(self):
        return f"{self.flight_number} {self.origin.code}->{self.destination.code} {self.departure_time:%Y-%m-%d %H:%M}"

    def clean(self):
        if self.origin_id and self.origin_id == self.destination_id:
            raise ValidationError("Origin and destination must differ.")
        if self.arrival_time and self.departure_time and self.arrival_time <= self.departure_time:
            raise ValidationError("Arrival must be after departure.")

    @property
    def booked_seats(self):
        return self.total_seats - self.available_seats
