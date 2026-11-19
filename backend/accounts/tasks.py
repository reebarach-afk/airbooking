import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail

from .models import User

logger = logging.getLogger(__name__)


@shared_task
def send_account_activated_email(user_id):
    """Email the user that their account was approved (runs in Celery)."""
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return
    body = (
        f"Hi {user.first_name or 'there'},\n\n"
        "Good news - your AirBooking account has been approved and is now active.\n"
        f"You can sign in here: {settings.FRONTEND_URL}/login\n\n"
        "Happy travels!\nThe AirBooking Team"
    )
    send_mail(
        subject="Your AirBooking account is activated",
        message=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )
    logger.info("Activation email sent to %s", user.email)


def _broker_is_up():
    """Cheap (0.5s) Redis ping so an absent broker doesn't stall the request."""
    if getattr(settings, "CELERY_TASK_ALWAYS_EAGER", False):
        return True
    url = settings.CELERY_BROKER_URL
    if not url.startswith("redis"):
        return True
    try:
        import redis

        return bool(redis.Redis.from_url(url, socket_connect_timeout=0.5, socket_timeout=0.5).ping())
    except Exception:
        return False


def queue_activation_email(user_id):
    """Dispatch via Celery; if the broker is down, send inline so nothing is lost."""
    if _broker_is_up():
        try:
            send_account_activated_email.apply_async(args=[user_id], retry=False)
            return
        except Exception as exc:
            logger.warning("Celery dispatch failed (%s); sending email synchronously.", exc)
    else:
        logger.warning("Celery broker (Redis) unreachable; sending activation email synchronously.")
    send_account_activated_email(user_id)
