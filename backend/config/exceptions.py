"""Consistent error shape: {"detail": "...", "errors": {...}} for every failure."""
from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return response
    data = response.data
    if isinstance(data, dict) and set(data.keys()) <= {"detail", "code"}:
        return response
    # Field-level validation errors -> add a human readable summary.
    if isinstance(data, dict):
        first = next(iter(data.values()), "Invalid request.")
        while isinstance(first, (list, tuple)) and first:
            first = first[0]
        if isinstance(first, dict):
            first = "Invalid request."
        response.data = {"detail": str(first), "errors": data}
    elif isinstance(data, list):
        response.data = {"detail": str(data[0]) if data else "Invalid request.", "errors": data}
    return response
