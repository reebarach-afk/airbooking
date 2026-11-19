import re

from django.utils import timezone
from rest_framework import serializers

from flights.models import Flight
from flights.serializers import FlightSerializer

from .models import Booking


class PassengerSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=80)
    age = serializers.IntegerField(min_value=0, max_value=120)

    def validate_name(self, value):
        value = value.strip()
        if len(value) < 2 or not re.fullmatch(r"[A-Za-z .'-]+", value):
            raise serializers.ValidationError("Enter the passenger's name as on their ID.")
        return value


class PaymentSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=["card", "upi", "netbanking"])
    card_number = serializers.CharField(required=False, allow_blank=True, write_only=True)
    upi_id = serializers.CharField(required=False, allow_blank=True, write_only=True)

    def validate(self, attrs):
        method = attrs["method"]
        if method == "card":
            digits = re.sub(r"[\s-]", "", attrs.get("card_number", ""))
            if not re.fullmatch(r"\d{13,19}", digits):
                raise serializers.ValidationError({"card_number": "Enter a valid card number."})
            attrs["card_number"] = digits
        if method == "upi" and not re.fullmatch(r"[\w.\-]{2,}@[\w]{2,}", attrs.get("upi_id", "")):
            raise serializers.ValidationError({"upi_id": "Enter a valid UPI ID (e.g. name@bank)."})
        return attrs


class BookingCreateSerializer(serializers.Serializer):
    flight = serializers.PrimaryKeyRelatedField(queryset=Flight.objects.all())
    passengers = PassengerSerializer(many=True, allow_empty=False)
    payment = PaymentSerializer()

    def validate_passengers(self, value):
        if len(value) > 9:
            raise serializers.ValidationError("You can book at most 9 seats at a time.")
        return value

    def validate(self, attrs):
        flight = attrs["flight"]
        if flight.status == Flight.Status.CANCELLED:
            raise serializers.ValidationError({"flight": "This flight has been cancelled."})
        if flight.departure_time <= timezone.now():
            raise serializers.ValidationError({"flight": "This flight has already departed."})
        return attrs


class BookingSerializer(serializers.ModelSerializer):
    flight = FlightSerializer(read_only=True)
    can_cancel = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    payment_status_display = serializers.CharField(source="get_payment_status_display", read_only=True)

    class Meta:
        model = Booking
        fields = [
            "id", "booking_ref", "flight", "seats", "passengers", "total_price",
            "status", "status_display", "payment_status", "payment_status_display",
            "payment_method", "payment_reference", "created_at", "cancelled_at", "can_cancel",
        ]
        read_only_fields = fields

    def get_can_cancel(self, obj):
        return obj.status == Booking.Status.CONFIRMED and obj.flight.departure_time > timezone.now()


class AdminBookingSerializer(BookingSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta(BookingSerializer.Meta):
        fields = BookingSerializer.Meta.fields + ["user_email"]
        read_only_fields = fields
