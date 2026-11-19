from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication


class ApprovedJWTAuthentication(JWTAuthentication):
    """A valid token is not enough: the account must still be approved.

    This makes a later rejection/suspension take effect immediately, instead of
    waiting for already-issued access tokens to expire.
    """

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if not user.is_approved:
            raise AuthenticationFailed("Your account is not approved.", code="not_approved")
        return user
