from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from app.dependencies import get_ocr_service
from app.services.ocr_service import OcrServiceWrapper
from app.models.response import APIResponse
from app.utils.logger import logger

router = APIRouter(prefix="/api/v1", tags=["OCR Extraction"])


@router.post("/ocr", response_model=APIResponse[str])
async def extract_ocr_text(
    file: UploadFile = File(...),
    ocr_service: OcrServiceWrapper = Depends(get_ocr_service),
):
    logger.info(f"Received OCR request: '{file.filename}'")
    file_bytes = await file.read()
    
    extracted_text = ocr_service.process_image(file_bytes)
    return APIResponse(
        success=True,
        message="OCR text extraction completed",
        data=extracted_text,
    )
