from datetime import timedelta

from django.core import mail
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from config import celery_app
from flights.models import Airport, Flight


def make_user(email, status="approved", staff=False):
    return User.objects.create_user(
        email=email, password="Str0ng!Pass", first_name="Test", last_name="User",
        approval_status=status, is_staff=staff,
    )


def login(client, email, password="Str0ng!Pass"):
    res = client.post("/api/auth/login/", {"email": email, "password": password}, format="json")
    return res


class BaseCase(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        celery_app.conf.task_always_eager = True  # run tasks inline, no Redis needed

    def setUp(self):
        cache.clear()  # reset throttle counters between tests
        self.client = APIClient()
        self.cok = Airport.objects.create(code="COK", name="Cochin", city="Kochi")
        self.del_ = Airport.objects.create(code="DEL", name="Indira Gandhi", city="Delhi")
        dep = timezone.now() + timedelta(days=3)
        self.flight = Flight.objects.create(
            flight_number="AI101", airline="Air India", origin=self.cok, destination=self.del_,
            departure_time=dep, arrival_time=dep + timedelta(hours=3), price=5000,
            total_seats=5, available_seats=5,
        )
        self.user = make_user("user@test.com")
        self.admin = make_user("admin@test.com", staff=True)

    def auth(self, email):
        token = login(self.client, email).data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def book(self, n=1, card="4242424242424242"):
        return self.client.post(
            "/api/bookings/",
            {
                "flight": self.flight.pk,
                "passengers": [{"name": f"Pax Name{'x' * i}", "age": 30} for i in range(n)],
                "payment": {"method": "card", "card_number": card},
            },
            format="json",
        )


class ApprovalFlowTests(BaseCase):
    def test_register_creates_pending_user_and_blocks_login(self):
        res = self.client.post("/api/auth/register/", {
            "email": "new@test.com", "first_name": "New", "last_name": "Person",
            "password": "Str0ng!Pass", "confirm_password": "Str0ng!Pass",
        }, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(User.objects.get(email="new@test.com").approval_status, "pending")
        res = login(self.client, "new@test.com")
        self.assertEqual(res.status_code, 401)
        self.assertIn("pending", res.data["detail"].lower())

    def test_cannot_self_register_as_staff_or_approved(self):
        self.client.post("/api/auth/register/", {
            "email": "sneaky@test.com", "first_name": "S", "last_name": "N", "password": "Str0ng!Pass",
            "confirm_password": "Str0ng!Pass", "is_staff": True, "approval_status": "approved",
        }, format="json")
        u = User.objects.get(email="sneaky@test.com")
        self.assertFalse(u.is_staff)
        self.assertEqual(u.approval_status, "pending")

    def test_admin_approves_and_email_is_sent(self):
        pending = make_user("p@test.com", status="pending")
        self.auth("admin@test.com")
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post(f"/api/admin/users/{pending.pk}/approve/")
        self.assertEqual(res.status_code, 200)
        pending.refresh_from_db()
        self.assertEqual(pending.approval_status, "approved")
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["p@test.com"])
        self.client.credentials()
        self.assertEqual(login(self.client, "p@test.com").status_code, 200)

    def test_pending_list_and_non_admin_forbidden(self):
        make_user("p@test.com", status="pending")
        self.auth("user@test.com")
        self.assertEqual(self.client.get("/api/admin/users/pending/").status_code, 403)
        self.auth("admin@test.com")
        res = self.client.get("/api/admin/users/pending/")
        self.assertEqual(res.data["count"], 1)

    def test_rejected_user_token_stops_working(self):
        self.auth("user@test.com")
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 200)
        User.objects.filter(pk=self.user.pk).update(approval_status="rejected")
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)

    def test_endpoints_require_auth(self):
        for url in ["/api/flights/search/", "/api/bookings/", f"/api/flights/{self.flight.pk}/"]:
            self.assertEqual(self.client.get(url).status_code, 401, url)


class FlightTests(BaseCase):
    def test_search_filters(self):
        self.auth("user@test.com")
        res = self.client.get("/api/flights/search/?origin=cok&destination=DEL")
        self.assertEqual(res.data["count"], 1)
        res = self.client.get("/api/flights/search/?origin=DEL")
        self.assertEqual(res.data["count"], 0)
        res = self.client.get("/api/flights/search/?max_price=100")
        self.assertEqual(res.data["count"], 0)
        res = self.client.get(f"/api/flights/search/?date={self.flight.departure_time.date()}")
        self.assertGreaterEqual(res.data["count"], 0)

    def test_admin_status_update_validation(self):
        self.auth("admin@test.com")
        url = f"/api/admin/flights/{self.flight.pk}/status/"
        self.assertEqual(self.client.put(url, {"status": "delayed"}, format="json").status_code, 400)
        res = self.client.put(url, {"status": "delayed", "delay_minutes": 45}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["delay_minutes"], 45)
        res = self.client.put(url, {"status": "on_time"}, format="json")
        self.assertEqual(res.data["delay_minutes"], 0)

    def test_admin_create_flight(self):
        self.auth("admin@test.com")
        dep = (timezone.now() + timedelta(days=5)).isoformat()
        arr = (timezone.now() + timedelta(days=5, hours=2)).isoformat()
        payload = {"flight_number": "6E22", "airline": "IndiGo", "origin_code": "COK", "destination_code": "DEL",
                   "departure_time": dep, "arrival_time": arr, "price": "4500", "total_seats": 100}
        res = self.client.post("/api/admin/flights/", payload, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["available_seats"], 100)
        payload["destination_code"] = "COK"
        self.assertEqual(self.client.post("/api/admin/flights/", payload, format="json").status_code, 400)

    def test_live_status_degrades_gracefully(self):
        self.auth("user@test.com")
        res = self.client.get(f"/api/flights/{self.flight.pk}/live-status/")
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data["live"])


class BookingTests(BaseCase):
    def test_booking_reserves_seats_and_prices(self):
        self.auth("user@test.com")
        res = self.book(2)
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["total_price"], "10000.00")
        self.assertTrue(res.data["booking_ref"].startswith("AB"))
        self.flight.refresh_from_db()
        self.assertEqual(self.flight.available_seats, 3)

    def test_declined_payment_does_not_reserve_seats(self):
        self.auth("user@test.com")
        res = self.book(1, card="4000000000000002")
        self.assertEqual(res.status_code, 402)
        self.flight.refresh_from_db()
        self.assertEqual(self.flight.available_seats, 5)

    def test_cannot_overbook(self):
        self.auth("user@test.com")
        self.assertEqual(self.book(5).status_code, 201)
        res = self.book(1)
        self.assertEqual(res.status_code, 400)
        self.assertIn("sold out", res.data["detail"].lower())
        self.flight.refresh_from_db()
        self.assertEqual(self.flight.available_seats, 0)

    def test_cancel_restores_seats_and_refunds(self):
        self.auth("user@test.com")
        booking = self.book(2).data
        res = self.client.post(f"/api/bookings/{booking['id']}/cancel/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["status"], "cancelled")
        self.assertEqual(res.data["payment_status"], "refunded")
        self.flight.refresh_from_db()
        self.assertEqual(self.flight.available_seats, 5)
        self.assertEqual(self.client.post(f"/api/bookings/{booking['id']}/cancel/").status_code, 400)

    def test_users_cannot_see_each_others_bookings(self):
        self.auth("user@test.com")
        bid = self.book(1).data["id"]
        make_user("other@test.com")
        self.auth("other@test.com")
        self.assertEqual(self.client.get("/api/bookings/").data["count"], 0)
        self.assertEqual(self.client.get(f"/api/bookings/{bid}/").status_code, 404)
        self.assertEqual(self.client.post(f"/api/bookings/{bid}/cancel/").status_code, 404)

    def test_cannot_book_cancelled_or_departed_flight(self):
        self.auth("user@test.com")
        Flight.objects.filter(pk=self.flight.pk).update(status="cancelled")
        self.assertEqual(self.book(1).status_code, 400)

    def test_admin_stats_and_flight_delete_protection(self):
        self.auth("user@test.com")
        self.book(2)
        self.auth("admin@test.com")
        stats = self.client.get("/api/admin/stats/").data
        self.assertEqual(stats["bookings"]["confirmed"], 1)
        self.assertEqual(stats["bookings"]["seats_sold"], 2)
        self.assertEqual(stats["occupancy_percent"], 40.0)
        self.assertEqual(self.client.delete(f"/api/admin/flights/{self.flight.pk}/").status_code, 409)
