from fastapi import APIRouter
from app.config import settings
from app.models.response import HealthResponse, APIResponse

router = APIRouter(tags=["Health"])


@router.get("/healthz", response_model=HealthResponse)
def get_liveness_health():
    return HealthResponse(
        status="ok",
        appName=settings.APP_NAME,
        environment=settings.APP_ENV,
        version="1.0.0",
    )


@router.get("/readiness", response_model=APIResponse[HealthResponse])
def get_readiness():
    health = HealthResponse(
        status="ready",
        appName=settings.APP_NAME,
        environment=settings.APP_ENV,
        version="1.0.0",
    )
    return APIResponse(success=True, message="Service is ready", data=health)
