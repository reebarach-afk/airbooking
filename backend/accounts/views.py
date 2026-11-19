from django.db import transaction
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import User
from .permissions import IsAdminUser
from .serializers import LoginSerializer, RegisterSerializer, UserSerializer
from .tasks import queue_activation_email


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "auth"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {
                "detail": "Registration successful. Your account is pending admin approval.",
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "auth"


class RefreshView(TokenRefreshView):
    authentication_classes = []
    throttle_scope = "auth"


class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)


# ------------------------------------------------------------------ admin API
class AdminUserListView(generics.ListAPIView):
    """All users; filter with ?status=pending|approved|rejected and ?search=."""

    serializer_class = UserSerializer
    permission_classes = [IsAdminUser]
    filterset_fields = {"approval_status": ["exact"], "is_active": ["exact"]}

    def get_queryset(self):
        qs = User.objects.all()
        search = self.request.query_params.get("search")
        if search:
            from django.db.models import Q

            qs = qs.filter(
                Q(email__icontains=search) | Q(first_name__icontains=search) | Q(last_name__icontains=search)
            )
        return qs


class PendingUserListView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAdminUser]
    queryset = User.objects.filter(approval_status=User.ApprovalStatus.PENDING).order_by("date_joined")


class _ReviewUserView(APIView):
    permission_classes = [IsAdminUser]
    new_status = None

    def post(self, request, pk):
        with transaction.atomic():
            try:
                user = User.objects.select_for_update().get(pk=pk)
            except User.DoesNotExist:
                return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
            if user.pk == request.user.pk:
                return Response({"detail": "You cannot change your own status."}, status=400)
            if user.approval_status == self.new_status:
                return Response({"detail": f"User is already {self.new_status}."}, status=400)
            user.approval_status = self.new_status
            user.approved_by = request.user
            user.approved_at = timezone.now()
            user.save(update_fields=["approval_status", "approved_by", "approved_at"])
            self.after_save(user)
        return Response({"detail": f"User {self.new_status}.", "user": UserSerializer(user).data})

    def after_save(self, user):
        pass


class ApproveUserView(_ReviewUserView):
    new_status = User.ApprovalStatus.APPROVED

    def after_save(self, user):
        # Only enqueue once the DB transaction has actually committed.
        transaction.on_commit(lambda: queue_activation_email(user.pk))


class RejectUserView(_ReviewUserView):
    new_status = User.ApprovalStatus.REJECTED
