from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings
from app.routes.health import router as health_router
from app.routes.parse import router as parse_router
from app.routes.ocr import router as ocr_router
from app.routes.upload import router as upload_router
from app.utils.logger import logger


def create_application() -> FastAPI:
    application = FastAPI(
        title=settings.APP_NAME,
        description="Production FastAPI Microservice for Bank Statement PDF Parsing, OCR Extraction, and Validation",
        version="1.0.0",
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
    )

    # Configure CORS Middleware supporting credentialed requests across localhost & Vercel deployments
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.get_cors_origins(),
        allow_origin_regex=r"https?://.*\.vercel\.app|http://(localhost|127\.0\.0\.1)(:\d+)?",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register Routers
    application.include_router(health_router)
    application.include_router(upload_router)
    application.include_router(parse_router)
    application.include_router(ocr_router)

    # Exception Handlers
    @application.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(f"Global exception intercepted at {request.url}: {str(exc)}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "message": "An internal server error occurred.",
                "detail": str(exc) if settings.DEBUG else None,
            },
        )

    return application


app = create_application()
