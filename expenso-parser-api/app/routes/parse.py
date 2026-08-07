import json
from typing import AsyncGenerator
from fastapi import APIRouter, Depends, UploadFile, File, Query, HTTPException, status, BackgroundTasks
from fastapi.responses import StreamingResponse
from app.dependencies import get_parser_service
from app.services.parser_service import ParserService
from app.models.response import APIResponse, ParserResultModel
from app.utils.logger import logger, log_pipeline_stage

router = APIRouter(prefix="/api/v1", tags=["Bank Statement Parsing"])


@router.post("/parse", response_model=APIResponse[ParserResultModel])
async def parse_statement(
    file: UploadFile = File(...),
    page: int = Query(1, ge=1, description="Page number for transaction pagination"),
    page_size: int = Query(50, ge=1, le=500, alias="pageSize", description="Transactions per page"),
    parser_service: ParserService = Depends(get_parser_service),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Only PDF bank statements are allowed.",
        )
        
    logger.info(f"Received statement parse request: '{file.filename}' (page={page}, pageSize={page_size})")
    file_bytes = await file.read()
    
    result = parser_service.parse_statement_pdf(file_bytes, file.filename)
    
    # Apply Pagination to transactions
    total_tx_count = len(result.transactions)
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paged_transactions = result.transactions[start_idx:end_idx]
    
    result.transactions = paged_transactions
    result.statement.total_transactions_count = total_tx_count
    
    return APIResponse(
        success=True,
        message=f"Bank statement parsed successfully (showing {len(paged_transactions)} of {total_tx_count} transactions)",
        data=result,
    )


@router.post("/parse/stream")
async def parse_statement_stream(
    file: UploadFile = File(...),
    parser_service: ParserService = Depends(get_parser_service),
):
    """
    Streaming Response Endpoint:
    Emits chunked JSON transaction rows page by page as the PDF document is parsed.
    Optimized for large multi-page PDFs.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Only PDF bank statements are allowed.",
        )

    file_bytes = await file.read()

    async def transaction_event_stream() -> AsyncGenerator[str, None]:
        generator = parser_service.digital_parser.parse_pages_generator(file_bytes)
        for page_idx, page_rows in enumerate(generator, start=1):
            chunk = {
                "page": page_idx,
                "rows_count": len(page_rows),
                "rows": page_rows,
            }
            yield json.dumps(chunk) + "\n"

    return StreamingResponse(
        transaction_event_stream(),
        media_type="application/x-ndjson",
    )
