from django.contrib import admin

from .models import ApiToken, Certificate, StudentProfile

admin.site.register(ApiToken)
admin.site.register(StudentProfile)
admin.site.register(Certificate)
