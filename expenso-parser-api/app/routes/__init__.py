from app.routes.health import router as health_router
from app.routes.parse import router as parse_router
from app.routes.ocr import router as ocr_router
from app.routes.upload import router as upload_router

__all__ = ["health_router", "parse_router", "ocr_router", "upload_router"]
