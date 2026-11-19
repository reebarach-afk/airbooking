"""Real-time flight tracking via AirLabs (key required) or OpenSky Network (free).

Never raises: any provider failure degrades to the airline-reported status stored
in our own database, so the UI always has something sensible to show.
"""
import logging

import requests
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger(__name__)
TIMEOUT = 6


def _base(flight):
    return {
        "flight_number": flight.flight_number,
        "scheduled_status": flight.status,
        "delay_minutes": flight.delay_minutes,
        "fetched_at": timezone.now().isoformat(),
        "position": None,
        "live": False,
        "source": "internal",
        "message": "Live tracking is not available for this flight. Showing the status reported by the airline.",
    }


def _airlabs(flight):
    resp = requests.get(
        "https://airlabs.co/api/v9/flights",
        params={"flight_iata": flight.flight_number, "api_key": settings.AIRLABS_API_KEY},
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    body = resp.json().get("response")
    item = body[0] if isinstance(body, list) and body else (body if isinstance(body, dict) else None)
    if not item or item.get("lat") is None:
        return None
    return {
        "source": "airlabs",
        "live": True,
        "position": {
            "latitude": item.get("lat"),
            "longitude": item.get("lng"),
            "altitude_m": item.get("alt"),
            "speed_kmh": item.get("speed"),
            "heading": item.get("dir"),
        },
        "phase": item.get("status"),  # scheduled / en-route / landed
        "message": "Live position from AirLabs.",
    }


def _opensky(flight):
    auth = (settings.OPENSKY_USERNAME, settings.OPENSKY_PASSWORD) if settings.OPENSKY_USERNAME else None
    resp = requests.get(
        "https://opensky-network.org/api/states/all",
        params={"icao24": flight.icao24.lower()},
        auth=auth,
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    states = resp.json().get("states") or []
    if not states:
        return {"message": "Aircraft is not currently transmitting (not airborne or out of receiver range)."}
    s = states[0]
    velocity = s[9]
    return {
        "source": "opensky",
        "live": True,
        "position": {
            "latitude": s[6],
            "longitude": s[5],
            "altitude_m": s[7] if s[7] is not None else s[13],
            "speed_kmh": round(velocity * 3.6) if velocity is not None else None,
            "heading": s[10],
            "on_ground": s[8],
            "callsign": (s[1] or "").strip(),
        },
        "phase": "on-ground" if s[8] else "airborne",
        "message": "Live position from OpenSky Network.",
    }


def get_live_status(flight):
    key = f"live-status:{flight.pk}:{flight.status}:{flight.delay_minutes}"
    cached = cache.get(key)
    if cached:
        return cached

    result = _base(flight)
    try:
        extra = None
        if settings.AIRLABS_API_KEY:
            extra = _airlabs(flight)
        if extra is None and flight.icao24:
            extra = _opensky(flight)
        if extra:
            result.update(extra)
    except (requests.RequestException, ValueError, IndexError, KeyError) as exc:
        logger.warning("Live status lookup failed for %s: %s", flight.flight_number, exc)
        result["message"] = "Live tracking provider is unreachable right now. Showing the airline-reported status."

    cache.set(key, result, settings.LIVE_STATUS_CACHE_SECONDS)
    return result
