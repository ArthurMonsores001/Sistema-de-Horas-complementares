from django.urls import path

from . import views

urlpatterns = [
    path("auth/register/", views.register, name="register"),
    path("auth/login/", views.login, name="login"),
    path("auth/me/", views.me, name="me"),
    path("profiles/", views.profiles, name="profiles"),
    path("profiles/sync/", views.sync, name="profiles-sync"),
    path("profiles/<str:registration>/", views.profile_detail, name="profile-detail"),
    path(
        "profiles/<str:registration>/certificates/<int:certificate_id>/",
        views.certificate_detail,
        name="certificate-detail",
    ),
]
