import secrets

from django.conf import settings
from django.db import models


class ApiToken(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="api_token")
    key = models.CharField(max_length=64, unique=True, default=secrets.token_hex)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"Token for {self.user}"


class StudentProfile(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="student_profiles")
    registration = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=160, blank=True)
    cpf = models.CharField(max_length=32, blank=True)
    rg = models.CharField(max_length=32, blank=True)
    course = models.CharField(max_length=120, default="engenharia")
    total_required = models.PositiveIntegerField(default=120)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self) -> str:
        return f"{self.registration} - {self.name or self.user.username}"


class Certificate(models.Model):
    profile = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name="certificates")
    client_id = models.BigIntegerField(null=True, blank=True)
    activity_id = models.PositiveIntegerField()
    description = models.CharField(max_length=255)
    hours = models.PositiveIntegerField()
    effective_hours = models.PositiveIntegerField(default=0)
    excess_hours = models.PositiveIntegerField(default=0)
    date = models.CharField(max_length=20, blank=True)
    location = models.CharField(max_length=160, blank=True)
    warnings = models.JSONField(default=list, blank=True)
    extracted_data = models.JSONField(null=True, blank=True)
    attachment_name = models.CharField(max_length=255, blank=True)
    attachment_type = models.CharField(max_length=120, blank=True)
    attachment_size = models.PositiveIntegerField(default=0)
    attachment_data_url = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.description
