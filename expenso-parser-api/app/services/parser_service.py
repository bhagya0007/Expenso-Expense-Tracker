import uuid
import time
from datetime import datetime
from typing import Tuple, List
from app.parser.pdf_parser import PdfParser
from app.parser.scanned_pdf_parser import ScannedPdfParser
from app.parser.pdf_type_detector import detect_pdf_type_and_strategy
from app.parser.transaction_normalizer import transaction_normalizer
from app.validators.duplicate_detector import duplicate_detector
from app.models.statement import BankStatementModel, StatementPeriod, BankStatementMetadata, ImportStatus
from app.models.transaction import BankTransactionModel, TransactionType
from app.models.response import ParserResultModel, ImportSummaryModel
from app.services.validation_service import ValidationService
from app.utils.logger import logger, log_pipeline_stage


class ParserService:
    def __init__(
        self,
        digital_parser: PdfParser = None,
        scanned_parser: ScannedPdfParser = None,
        validation_service: ValidationService = None,
    ):
        self.digital_parser = digital_parser or PdfParser()
        self.scanned_parser = scanned_parser or ScannedPdfParser()
        self.validation_service = validation_service or ValidationService()

    def parse_statement_pdf(self, file_bytes: bytes, file_name: str, user_id: str = "usr_default") -> ParserResultModel:
        start_time = time.time()
        statement_id = f"stmt_{uuid.uuid4().hex[:8]}"

        # STAGE 1: UPLOAD
        log_pipeline_stage(
            stage_name="UPLOAD",
            message=f"Started processing uploaded file '{file_name}' ({len(file_bytes)} bytes)",
            file_id=statement_id,
        )

        # STAGE 2: DETECTION
        pdf_type, strategy, page_count = detect_pdf_type_and_strategy(file_bytes)
        log_pipeline_stage(
            stage_name="DETECTION",
            message=f"PDF type detected as '{pdf_type.upper()}' using strategy '{strategy}' across {page_count} pages",
            file_id=statement_id,
            extra_details={"pdf_type": pdf_type, "strategy": strategy, "pages": page_count},
        )

        # STAGE 3: OCR (if scanned) / STAGE 4: ROWS Extraction
        if pdf_type == "scanned":
            log_pipeline_stage(
                stage_name="OCR",
                message=f"Executing OpenCV preprocessing and PaddleOCR bounding box extraction",
                file_id=statement_id,
            )
            parsed_data = self.scanned_parser.parse_content(file_bytes, file_name)
        else:
            parsed_data = self.digital_parser.parse_content(file_bytes, file_name)
            # Automatic Fallback: If digital text parser returned < 2 rows (image-embedded or scanned PDF with header text), retry with OCR!
            if not parsed_data.get("rows") or len(parsed_data["rows"]) < 2:
                logger.info(f"Digital parser extracted {len(parsed_data.get('rows', []))} rows. Automatically falling back to OCR engine...")
                log_pipeline_stage(
                    stage_name="OCR",
                    message="Digital parser returned < 2 rows. Retrying statement extraction using OCR engine...",
                    file_id=statement_id,
                )
                parsed_data = self.scanned_parser.parse_content(file_bytes, file_name)

        raw_rows = parsed_data.get("rows", [])
        log_pipeline_stage(
            stage_name="ROWS",
            message=f"Extracted and reconstructed {len(raw_rows)} raw transaction rows",
            file_id=statement_id,
            extra_details={"headers": parsed_data.get("detected_headers", []), "raw_rows_count": len(raw_rows)},
        )

        # Convert raw extracted rows into normalized BankTransactionModel entities
        normalized_transactions = transaction_normalizer.normalize_rows_list(raw_rows, statement_id=statement_id)

        # Deduplicate transactions
        unique_transactions, duplicate_transactions, duplicates_skipped = duplicate_detector.filter_duplicate_transactions(normalized_transactions)

        # Construct BankStatementModel
        bank_id = parsed_data.get("bank_id", "generic")
        bank_name = parsed_data.get("bank_name", "Generic Indian Bank")

        start_dt = unique_transactions[0].date if unique_transactions else datetime.utcnow()
        end_dt = unique_transactions[-1].date if unique_transactions else datetime.utcnow()

        statement = BankStatementModel(
            id=statement_id,
            userId=user_id,
            fileName=file_name,
            fileSizeBytes=len(file_bytes),
            mimeType="application/pdf",
            bankId=bank_id,
            bankName=bank_name,
            accountNumberMask="XXXX-XXXX-1234",
            period=StatementPeriod(startDate=start_dt, endDate=end_dt),
            openingBalance=unique_transactions[0].balance if unique_transactions else 0.0,
            closingBalance=unique_transactions[-1].balance if unique_transactions else 0.0,
            totalTransactionsCount=len(unique_transactions),
            status=ImportStatus.COMPLETED,
            uploadedAt=datetime.utcnow(),
            processedAt=datetime.utcnow(),
            metadata=BankStatementMetadata(pageCount=page_count),
        )

        # STAGE 5: VALIDATION
        log_pipeline_stage(
            stage_name="VALIDATION",
            message=f"Executing row-level validation (Date, Amount, Balance, Debit, Credit) & sequence continuity checks",
            file_id=statement_id,
        )
        validated_txs, validation_errors, rejected_count = self.validation_service.validate_parsed_data(statement, unique_transactions)

        duration_ms = int((time.time() - start_time) * 1000)

        # STAGE 6: IMPORT
        log_pipeline_stage(
            stage_name="IMPORT",
            message=f"Completed statement import: {len(validated_txs)} rows imported, {duplicates_skipped} duplicates skipped, {rejected_count} invalid rows quarantined ({duration_ms} ms)",
            file_id=statement_id,
            extra_details={
                "imported": len(validated_txs),
                "duplicates_skipped": duplicates_skipped,
                "quarantined": rejected_count,
                "duration_ms": duration_ms,
            },
        )

        summary = ImportSummaryModel(
            statementId=statement_id,
            totalParsedRows=len(raw_rows),
            totalImportedRows=len(validated_txs),
            totalDuplicatesSkipped=duplicates_skipped,
            totalFailedRows=rejected_count,
            totalDebitsAmount=sum(t.amount for t in validated_txs if t.type == TransactionType.DEBIT),
            totalCreditsAmount=sum(t.amount for t in validated_txs if t.type == TransactionType.CREDIT),
            netBalanceChange=sum(t.amount if t.type == TransactionType.CREDIT else -t.amount for t in validated_txs),
            startedAt=statement.uploaded_at,
            completedAt=datetime.utcnow(),
            durationMs=duration_ms,
        )

        return ParserResultModel(
            statement=statement,
            transactions=validated_txs,
            summary=summary,
            errors=[],
            validationErrors=validation_errors,
            isSuccess=True,
        )
