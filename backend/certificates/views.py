import json
from functools import wraps

from django.contrib.auth import authenticate, get_user_model
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import ApiToken, Certificate, StudentProfile


def parse_body(request: HttpRequest) -> dict:
    if not request.body:
        return {}
    return json.loads(request.body.decode("utf-8"))


def token_response(user):
    token, _ = ApiToken.objects.get_or_create(user=user)
    return JsonResponse({
        "token": token.key,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
        },
    })


def get_authenticated_user(request: HttpRequest):
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    key = header.removeprefix("Bearer ").strip()
    token = ApiToken.objects.select_related("user").filter(key=key).first()
    return token.user if token else None


def auth_required(view):
    @wraps(view)
    def wrapped(request: HttpRequest, *args, **kwargs):
        user = get_authenticated_user(request)
        if not user:
            return JsonResponse({"detail": "Autenticação necessária."}, status=401)
        request.api_user = user
        return view(request, *args, **kwargs)

    return wrapped


def normalize_registration(registration: str) -> str:
    return "".join(registration.split()).lower()


def student_to_payload(profile: StudentProfile) -> dict:
    return {
        "name": profile.name,
        "registration": profile.registration,
        "cpf": profile.cpf,
        "rg": profile.rg,
        "course": profile.course,
        "totalRequired": profile.total_required,
    }


def certificate_to_payload(certificate: Certificate) -> dict:
    payload = {
        "id": certificate.client_id or certificate.id,
        "serverId": certificate.id,
        "activityId": certificate.activity_id,
        "description": certificate.description,
        "hours": certificate.hours,
        "effectiveHours": certificate.effective_hours,
        "excessHours": certificate.excess_hours,
        "date": certificate.date,
        "location": certificate.location,
        "warnings": certificate.warnings,
        "createdAt": certificate.created_at.isoformat(),
        "updatedAt": certificate.updated_at.isoformat(),
    }
    if certificate.extracted_data:
        payload["extractedData"] = certificate.extracted_data
    if certificate.attachment_data_url:
        payload["attachment"] = {
            "name": certificate.attachment_name,
            "type": certificate.attachment_type,
            "size": certificate.attachment_size,
            "dataUrl": certificate.attachment_data_url,
        }
    return payload


def profile_to_payload(profile: StudentProfile) -> dict:
    return {
        "registration": profile.registration,
        "student": student_to_payload(profile),
        "certificates": [certificate_to_payload(c) for c in profile.certificates.all()],
        "updatedAt": profile.updated_at.isoformat(),
    }


def profile_from_payload(user, payload: dict) -> StudentProfile:
    student = payload.get("student", payload)
    registration = normalize_registration(student.get("registration", ""))
    if not registration:
        raise ValueError("Matrícula é obrigatória.")

    profile, _ = StudentProfile.objects.update_or_create(
        registration=registration,
        defaults={
            "user": user,
            "name": student.get("name", ""),
            "cpf": student.get("cpf", ""),
            "rg": student.get("rg", ""),
            "course": student.get("course", "engenharia"),
            "total_required": int(student.get("totalRequired") or 120),
        },
    )
    return profile


def certificate_from_payload(profile: StudentProfile, payload: dict) -> Certificate:
    attachment = payload.get("attachment") or {}
    defaults = {
        "profile": profile,
        "client_id": payload.get("id"),
        "activity_id": int(payload.get("activityId") or payload.get("activity_id") or 0),
        "description": payload.get("description", ""),
        "hours": int(payload.get("hours") or 0),
        "effective_hours": int(payload.get("effectiveHours") or payload.get("effective_hours") or 0),
        "excess_hours": int(payload.get("excessHours") or payload.get("excess_hours") or 0),
        "date": payload.get("date", ""),
        "location": payload.get("location", ""),
        "warnings": payload.get("warnings") or [],
        "extracted_data": payload.get("extractedData") or payload.get("extracted_data"),
        "attachment_name": attachment.get("name", ""),
        "attachment_type": attachment.get("type", ""),
        "attachment_size": int(attachment.get("size") or 0),
        "attachment_data_url": attachment.get("dataUrl", ""),
    }
    server_id = payload.get("serverId")
    if server_id:
        certificate, _ = Certificate.objects.update_or_create(
            id=server_id,
            profile=profile,
            defaults=defaults,
        )
        return certificate
    return Certificate.objects.create(**defaults)


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def register(request: HttpRequest):
    data = parse_body(request)
    username = data.get("username", "").strip()
    password = data.get("password", "")
    email = data.get("email", "").strip()
    if not username or not password:
        return JsonResponse({"detail": "Usuário e senha são obrigatórios."}, status=400)

    User = get_user_model()
    if User.objects.filter(username=username).exists():
        return JsonResponse({"detail": "Este usuário já existe."}, status=400)

    user = User.objects.create_user(username=username, email=email, password=password)
    return token_response(user)


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def login(request: HttpRequest):
    data = parse_body(request)
    user = authenticate(username=data.get("username", ""), password=data.get("password", ""))
    if not user:
        return JsonResponse({"detail": "Usuário ou senha inválidos."}, status=400)
    return token_response(user)


@csrf_exempt
@auth_required
@require_http_methods(["GET", "OPTIONS"])
def me(request: HttpRequest):
    return JsonResponse({
        "user": {
            "id": request.api_user.id,
            "username": request.api_user.username,
            "email": request.api_user.email,
        }
    })


@csrf_exempt
@auth_required
@require_http_methods(["GET", "POST", "OPTIONS"])
def profiles(request: HttpRequest):
    if request.method == "GET":
        profiles_qs = StudentProfile.objects.filter(user=request.api_user).prefetch_related("certificates")
        return JsonResponse({"profiles": [profile_to_payload(profile) for profile in profiles_qs]})

    data = parse_body(request)
    try:
        profile = profile_from_payload(request.api_user, data)
    except ValueError as exc:
        return JsonResponse({"detail": str(exc)}, status=400)

    return JsonResponse({"profile": profile_to_payload(profile)})


@csrf_exempt
@auth_required
@require_http_methods(["POST", "OPTIONS"])
def sync(request: HttpRequest):
    data = parse_body(request)
    profiles_payload = data.get("profiles", {})

    for profile_payload in profiles_payload.values():
        profile = profile_from_payload(request.api_user, profile_payload)
        profile.certificates.all().delete()
        for cert_payload in profile_payload.get("certificates", []):
            certificate_from_payload(profile, cert_payload)

    profiles_qs = StudentProfile.objects.filter(user=request.api_user).prefetch_related("certificates")
    return JsonResponse({"profiles": [profile_to_payload(profile) for profile in profiles_qs]})


@csrf_exempt
@auth_required
@require_http_methods(["DELETE", "OPTIONS"])
def profile_detail(request: HttpRequest, registration: str):
    key = normalize_registration(registration)
    deleted, _ = StudentProfile.objects.filter(user=request.api_user, registration=key).delete()
    if not deleted:
        return JsonResponse({"detail": "Perfil não encontrado."}, status=404)
    return JsonResponse({"ok": True})


@csrf_exempt
@auth_required
@require_http_methods(["POST", "PUT", "DELETE", "OPTIONS"])
def certificate_detail(request: HttpRequest, registration: str, certificate_id: int):
    profile = StudentProfile.objects.filter(user=request.api_user, registration=normalize_registration(registration)).first()
    if not profile:
        return JsonResponse({"detail": "Perfil não encontrado."}, status=404)

    if request.method == "DELETE":
        deleted, _ = Certificate.objects.filter(profile=profile, id=certificate_id).delete()
        if not deleted:
            return JsonResponse({"detail": "Certificado não encontrado."}, status=404)
        return JsonResponse({"ok": True})

    data = parse_body(request)
    data["serverId"] = certificate_id
    certificate = certificate_from_payload(profile, data)
    return JsonResponse({"certificate": certificate_to_payload(certificate)})
