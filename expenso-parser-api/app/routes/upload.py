import uuid
from pathlib import Path
from pydantic import BaseModel, Field
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from app.config import settings
from app.models.response import APIResponse
from app.parser.pdf_type_detector import detect_pdf_type_and_strategy
from app.utils.logger import logger, log_pipeline_stage

router = APIRouter(prefix="/api", tags=["PDF Upload"])


class UploadResponseData(BaseModel):
    file_id: str = Field(..., alias="fileId")
    file_name: str = Field(..., alias="fileName")
    file_size_bytes: int = Field(..., alias="fileSizeBytes")
    pages: int
    pdf_type: str = Field(..., alias="pdfType")
    strategy: str


@router.post("/upload", response_model=APIResponse[UploadResponseData])
async def upload_pdf_statement(file: UploadFile = File(...)):
    filename = file.filename or "statement.pdf"
    is_pdf_mime = file.content_type == "application/pdf"
    is_pdf_ext = filename.lower().endswith(".pdf")
    
    if not (is_pdf_mime or is_pdf_ext):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only PDF bank statements are allowed.",
        )

    file_bytes = await file.read()
    file_size = len(file_bytes)
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    
    if file_size > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size ({file_size / (1024*1024):.1f} MB) exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB} MB.",
        )

    temp_dir = Path(settings.TEMP_STORAGE_DIR)
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    file_id = f"file_{uuid.uuid4().hex[:10]}"
    temp_file_path = temp_dir / f"{file_id}.pdf"
    
    with open(temp_file_path, "wb") as f:
        f.write(file_bytes)

    # Stage 1: UPLOAD Logging
    log_pipeline_stage(
        stage_name="UPLOAD",
        message=f"Received and stored PDF statement '{filename}' ({file_size} bytes)",
        file_id=file_id,
        extra_details={"temp_path": str(temp_file_path), "file_size_bytes": file_size},
    )

    # Stage 2: DETECTION Logging
    pdf_type, strategy, pages_count = detect_pdf_type_and_strategy(file_bytes)
    log_pipeline_stage(
        stage_name="DETECTION",
        message=f"Analyzed PDF format: classified as '{pdf_type.upper()}' using strategy '{strategy}' across {pages_count} pages",
        file_id=file_id,
        extra_details={"pdf_type": pdf_type, "strategy": strategy, "pages": pages_count},
    )

    response_data = UploadResponseData(
        fileId=file_id,
        fileName=filename,
        fileSizeBytes=file_size,
        pages=pages_count,
        pdfType=pdf_type,
        strategy=strategy,
    )

    return APIResponse(
        success=True,
        message=f"PDF statement uploaded and analyzed as {pdf_type.upper()} ({strategy})",
        data=response_data,
    )
