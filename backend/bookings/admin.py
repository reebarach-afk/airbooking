from django.contrib import admin

from .models import Booking


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ("booking_ref", "user", "flight", "seats", "total_price", "status", "payment_status", "created_at")
    list_filter = ("status", "payment_status")
    search_fields = ("booking_ref", "user__email")
