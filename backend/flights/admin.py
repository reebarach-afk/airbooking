from django.contrib import admin

from .models import Airport, Flight


@admin.register(Airport)
class AirportAdmin(admin.ModelAdmin):
    list_display = ("code", "city", "name", "country")
    search_fields = ("code", "city", "name")


@admin.register(Flight)
class FlightAdmin(admin.ModelAdmin):
    list_display = ("flight_number", "origin", "destination", "departure_time", "price", "available_seats", "status")
    list_filter = ("status", "origin", "destination")
    search_fields = ("flight_number", "airline")
