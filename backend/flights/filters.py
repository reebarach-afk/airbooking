import django_filters
from django.utils import timezone

from .models import Flight


class FlightFilter(django_filters.FilterSet):
    origin = django_filters.CharFilter(field_name="origin__code", lookup_expr="iexact")
    destination = django_filters.CharFilter(field_name="destination__code", lookup_expr="iexact")
    date = django_filters.DateFilter(field_name="departure_time", lookup_expr="date")
    min_price = django_filters.NumberFilter(field_name="price", lookup_expr="gte")
    max_price = django_filters.NumberFilter(field_name="price", lookup_expr="lte")
    airline = django_filters.CharFilter(field_name="airline", lookup_expr="icontains")
    min_seats = django_filters.NumberFilter(field_name="available_seats", lookup_expr="gte")
    available_only = django_filters.BooleanFilter(method="filter_available")

    class Meta:
        model = Flight
        fields = ["status"]

    def filter_available(self, queryset, name, value):
        return queryset.filter(available_seats__gt=0) if value else queryset


def upcoming(queryset):
    return queryset.filter(departure_time__gt=timezone.now())
