from django.utils import timezone
from rest_framework import serializers

from .models import Airport, Flight


class AirportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Airport
        fields = ["id", "code", "name", "city", "country"]


class FlightSerializer(serializers.ModelSerializer):
    """Read serializer for travellers."""

    origin = AirportSerializer(read_only=True)
    destination = AirportSerializer(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    duration_minutes = serializers.SerializerMethodField()

    class Meta:
        model = Flight
        fields = [
            "id", "flight_number", "airline", "origin", "destination",
            "departure_time", "arrival_time", "duration_minutes", "price",
            "total_seats", "available_seats", "status", "status_display",
            "delay_minutes", "aircraft",
        ]

    def get_duration_minutes(self, obj):
        return int((obj.arrival_time - obj.departure_time).total_seconds() // 60)


class AdminFlightSerializer(serializers.ModelSerializer):
    """Write serializer for admins; airports are passed as IATA codes."""

    origin_code = serializers.SlugRelatedField(
        source="origin", slug_field="code", queryset=Airport.objects.all(), write_only=True
    )
    destination_code = serializers.SlugRelatedField(
        source="destination", slug_field="code", queryset=Airport.objects.all(), write_only=True
    )
    origin = AirportSerializer(read_only=True)
    destination = AirportSerializer(read_only=True)
    booked_seats = serializers.IntegerField(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Flight
        fields = [
            "id", "flight_number", "airline", "origin", "destination", "origin_code", "destination_code",
            "departure_time", "arrival_time", "price", "total_seats", "available_seats", "booked_seats",
            "status", "status_display", "delay_minutes", "aircraft", "icao24",
        ]
        read_only_fields = ["available_seats", "status", "delay_minutes"]

    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Price must be greater than zero.")
        return value

    def validate_total_seats(self, value):
        if value < 1 or value > 900:
            raise serializers.ValidationError("Seats must be between 1 and 900.")
        return value

    def validate_icao24(self, value):
        value = value.strip().lower()
        if value and (len(value) != 6 or any(c not in "0123456789abcdef" for c in value)):
            raise serializers.ValidationError("ICAO24 must be 6 hex characters.")
        return value

    def validate(self, attrs):
        inst = self.instance
        origin = attrs.get("origin", getattr(inst, "origin", None))
        dest = attrs.get("destination", getattr(inst, "destination", None))
        dep = attrs.get("departure_time", getattr(inst, "departure_time", None))
        arr = attrs.get("arrival_time", getattr(inst, "arrival_time", None))
        if origin and dest and origin == dest:
            raise serializers.ValidationError("Origin and destination must differ.")
        if dep and arr and arr <= dep:
            raise serializers.ValidationError({"arrival_time": "Arrival must be after departure."})
        if inst is None and dep and dep <= timezone.now():
            raise serializers.ValidationError({"departure_time": "Departure must be in the future."})
        if inst is not None and "total_seats" in attrs and attrs["total_seats"] < inst.booked_seats:
            raise serializers.ValidationError(
                {"total_seats": f"Cannot go below {inst.booked_seats} seats that are already booked."}
            )
        return attrs

    def create(self, validated_data):
        validated_data["available_seats"] = validated_data["total_seats"]
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if "total_seats" in validated_data:
            validated_data["available_seats"] = validated_data["total_seats"] - instance.booked_seats
        return super().update(instance, validated_data)


class FlightStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Flight.Status.choices)
    delay_minutes = serializers.IntegerField(min_value=0, max_value=1440, required=False, default=0)

    def validate(self, attrs):
        if attrs["status"] == Flight.Status.DELAYED and attrs.get("delay_minutes", 0) <= 0:
            raise serializers.ValidationError({"delay_minutes": "Provide delay minutes (> 0) for a delayed flight."})
        if attrs["status"] != Flight.Status.DELAYED:
            attrs["delay_minutes"] = 0
        return attrs
