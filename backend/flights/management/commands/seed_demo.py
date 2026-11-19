"""python manage.py seed_demo  - creates airports, ~14 days of flights and demo accounts."""
import random
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from flights.models import Airport, Flight

User = get_user_model()

AIRPORTS = [
    ("COK", "Cochin International Airport", "Kochi", "India"),
    ("TRV", "Trivandrum International Airport", "Thiruvananthapuram", "India"),
    ("CCJ", "Calicut International Airport", "Kozhikode", "India"),
    ("BLR", "Kempegowda International Airport", "Bengaluru", "India"),
    ("DEL", "Indira Gandhi International Airport", "Delhi", "India"),
    ("BOM", "Chhatrapati Shivaji Maharaj International Airport", "Mumbai", "India"),
    ("MAA", "Chennai International Airport", "Chennai", "India"),
    ("HYD", "Rajiv Gandhi International Airport", "Hyderabad", "India"),
    ("CCU", "Netaji Subhas Chandra Bose International Airport", "Kolkata", "India"),
    ("DXB", "Dubai International Airport", "Dubai", "UAE"),
    ("SIN", "Singapore Changi Airport", "Singapore", "Singapore"),
]
# (origin, destination, minutes, base price, airline prefixes)
ROUTES = [
    ("COK", "DEL", 215, 6200), ("COK", "BLR", 80, 2900), ("COK", "BOM", 130, 4300),
    ("COK", "MAA", 85, 2700), ("COK", "DXB", 235, 14500), ("TRV", "BLR", 95, 3200),
    ("TRV", "DEL", 230, 6900), ("TRV", "BOM", 145, 4600), ("TRV", "DXB", 250, 15500),
    ("TRV", "MAA", 90, 2800), ("CCJ", "BLR", 75, 2800), ("CCJ", "DXB", 230, 14000),
    ("BLR", "DEL", 175, 5200), ("BOM", "DEL", 130, 4500), ("HYD", "COK", 105, 3400),
    ("CCU", "COK", 170, 5600), ("SIN", "COK", 245, 17500), ("DEL", "TRV", 235, 7100),
]
AIRLINES = [("Air India", "AI"), ("IndiGo", "6E"), ("Akasa Air", "QP"), ("Air India Express", "IX")]
AIRCRAFT = ["Airbus A320neo", "Boeing 737-800", "Airbus A321", "Boeing 737 MAX 8"]


class Command(BaseCommand):
    help = "Seed airports, flights (next 14 days) and demo users."

    def add_arguments(self, parser):
        parser.add_argument("--reset-flights", action="store_true", help="Delete flights without bookings first.")

    def handle(self, *args, **opts):
        rng = random.Random(42)
        airports = {}
        for code, name, city, country in AIRPORTS:
            airports[code], _ = Airport.objects.get_or_create(
                code=code, defaults={"name": name, "city": city, "country": country}
            )

        if opts["reset_flights"]:
            Flight.objects.filter(bookings__isnull=True).delete()

        created = 0
        today = timezone.localtime().replace(hour=0, minute=0, second=0, microsecond=0)
        for day in range(1, 15):
            for origin, dest, minutes, base in ROUTES:
                for slot_hour in rng.sample([5, 7, 9, 11, 14, 17, 19, 21], k=2):
                    airline, prefix = rng.choice(AIRLINES)
                    number = f"{prefix}{rng.randint(100, 999)}"
                    dep = today + timedelta(days=day, hours=slot_hour, minutes=rng.choice([0, 15, 30, 45]))
                    seats = rng.choice([150, 180, 186, 220])
                    price = Decimal(base) * Decimal(rng.uniform(0.85, 1.35)).quantize(Decimal("0.01"))
                    _, was_new = Flight.objects.get_or_create(
                        flight_number=number, departure_time=dep,
                        defaults=dict(
                            airline=airline, origin=airports[origin], destination=airports[dest],
                            arrival_time=dep + timedelta(minutes=minutes), price=price.quantize(Decimal("1")),
                            total_seats=seats, available_seats=seats, aircraft=rng.choice(AIRCRAFT),
                        ),
                    )
                    created += was_new

        # A few delayed flights so the status UI has something to show.
        for f in Flight.objects.filter(status="on_time").order_by("?")[:6]:
            f.status, f.delay_minutes = "delayed", rng.choice([20, 35, 50, 90])
            f.save(update_fields=["status", "delay_minutes"])

        admin, made = User.objects.get_or_create(
            email="admin@airbooking.com",
            defaults=dict(first_name="Site", last_name="Admin", is_staff=True, is_superuser=True, approval_status="approved"),
        )
        if made:
            admin.set_password("Admin@12345")
            admin.save()

        demo = [
            ("traveller@airbooking.com", "Asha", "Nair", "approved"),
            ("pending.user@airbooking.com", "Rahul", "Menon", "pending"),
        ]
        for email, first, last, st in demo:
            u, made = User.objects.get_or_create(
                email=email, defaults=dict(first_name=first, last_name=last, approval_status=st)
            )
            if made:
                u.set_password("User@12345")
                u.save()

        self.stdout.write(self.style.SUCCESS(f"Seeded {created} new flights."))
        self.stdout.write("Admin:    admin@airbooking.com / Admin@12345")
        self.stdout.write("Traveller: traveller@airbooking.com / User@12345 (approved)")
        self.stdout.write("Pending:   pending.user@airbooking.com / User@12345 (awaiting approval)")
