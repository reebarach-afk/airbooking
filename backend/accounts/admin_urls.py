from django.urls import path

from . import views

urlpatterns = [
    path("users/", views.AdminUserListView.as_view(), name="admin-users"),
    path("users/pending/", views.PendingUserListView.as_view(), name="admin-users-pending"),
    path("users/<int:pk>/approve/", views.ApproveUserView.as_view(), name="admin-user-approve"),
    path("users/<int:pk>/reject/", views.RejectUserView.as_view(), name="admin-user-reject"),
]
