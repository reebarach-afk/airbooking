from django.urls import path

from . import views

urlpatterns = [
    path("airports/", views.AirportListView.as_view(), name="airports"),
    path("search/", views.FlightSearchView.as_view(), name="flight-search"),
    path("<int:pk>/", views.FlightDetailView.as_view(), name="flight-detail"),
    path("<int:pk>/live-status/", views.FlightLiveStatusView.as_view(), name="flight-live-status"),
]
