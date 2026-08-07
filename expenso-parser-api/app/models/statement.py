from enum import Enum
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class ImportStatus(str, Enum):
    IDLE = "idle"
    UPLOADING = "uploading"
    PREPROCESSING = "preprocessing"
    DETECTING_BANK = "detecting_bank"
    EXTRACTING_TEXT = "extracting_text"
    PARSING_ROWS = "parsing_rows"
    VALIDATING = "validating"
    IMPORTING = "importing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class StatementPeriod(BaseModel):
    start_date: Optional[datetime] = Field(None, alias="startDate")
    end_date: Optional[datetime] = Field(None, alias="endDate")


class BankStatementMetadata(BaseModel):
    account_name: Optional[str] = Field(None, alias="accountName")
    account_type: Optional[str] = Field(None, alias="accountType")
    branch_name: Optional[str] = Field(None, alias="branchName")
    ifsc_code: Optional[str] = Field(None, alias="ifscCode")
    currency: str = "INR"
    is_password_protected: bool = Field(False, alias="isPasswordProtected")
    page_count: int = Field(1, alias="pageCount")


class BankStatementModel(BaseModel):
    id: str
    user_id: str = Field(..., alias="userId")
    file_name: str = Field(..., alias="fileName")
    file_size_bytes: int = Field(..., alias="fileSizeBytes")
    mime_type: str = Field("application/pdf", alias="mimeType")
    bank_id: str = Field(..., alias="bankId")
    bank_name: str = Field(..., alias="bankName")
    account_number_mask: Optional[str] = Field(None, alias="accountNumberMask")
    period: StatementPeriod
    opening_balance: Optional[float] = Field(None, alias="openingBalance")
    closing_balance: Optional[float] = Field(None, alias="closingBalance")
    total_transactions_count: int = Field(0, alias="totalTransactionsCount")
    status: ImportStatus = ImportStatus.COMPLETED
    uploaded_at: datetime = Field(default_factory=datetime.utcnow, alias="uploadedAt")
    processed_at: Optional[datetime] = Field(None, alias="processedAt")
    metadata: BankStatementMetadata
