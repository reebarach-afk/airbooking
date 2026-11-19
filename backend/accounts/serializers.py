import re

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name", "full_name", "phone",
            "approval_status", "role", "is_active", "date_joined", "approved_at",
        ]
        read_only_fields = fields

    def get_role(self, obj):
        return "admin" if obj.is_staff else "user"


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["email", "first_name", "last_name", "phone", "password", "confirm_password"]
        extra_kwargs = {"first_name": {"required": True}, "last_name": {"required": True}}

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_phone(self, value):
        if value and not re.fullmatch(r"\+?\d{10,14}", value):
            raise serializers.ValidationError("Enter a valid phone number (10-14 digits).")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("confirm_password"):
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        validate_password(attrs["password"], User(email=attrs["email"]))
        return attrs

    def create(self, validated_data):
        # approval_status defaults to PENDING; staff flags can never be set here.
        return User.objects.create_user(**validated_data)


class LoginSerializer(TokenObtainPairSerializer):
    """Only approved users get tokens; others get a clear, specific message."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = "admin" if user.is_staff else "user"
        token["name"] = user.full_name
        return token

    def validate(self, attrs):
        data = super().validate(attrs)  # raises on bad credentials
        user = self.user
        if user.approval_status == User.ApprovalStatus.PENDING:
            raise AuthenticationFailed(
                "Your account is pending admin approval. You'll get an email once it's activated.",
                code="pending_approval",
            )
        if user.approval_status == User.ApprovalStatus.REJECTED:
            raise AuthenticationFailed("Your registration was not approved.", code="rejected")
        data["user"] = UserSerializer(user).data
        return data
