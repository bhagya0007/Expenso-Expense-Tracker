from typing import Optional, List, Generic, TypeVar
from datetime import datetime
from pydantic import BaseModel, Field
from app.models.statement import BankStatementModel
from app.models.transaction import BankTransactionModel
from app.models.error import ParserErrorModel, ValidationErrorModel

T = TypeVar("T")


class APIResponse(BaseModel, Generic[T]):
    success: bool = True
    message: str = "Operation completed successfully"
    data: Optional[T] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class HealthResponse(BaseModel):
    status: str = "ok"
    app_name: str = Field(..., alias="appName")
    environment: str
    version: str = "1.0.0"
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ImportSummaryModel(BaseModel):
    statement_id: str = Field(..., alias="statementId")
    total_parsed_rows: int = Field(0, alias="totalParsedRows")
    total_imported_rows: int = Field(0, alias="totalImportedRows")
    total_duplicates_skipped: int = Field(0, alias="totalDuplicatesSkipped")
    total_failed_rows: int = Field(0, alias="totalFailedRows")
    total_debits_amount: float = Field(0.0, alias="totalDebitsAmount")
    total_credits_amount: float = Field(0.0, alias="totalCreditsAmount")
    net_balance_change: float = Field(0.0, alias="netBalanceChange")
    started_at: datetime = Field(default_factory=datetime.utcnow, alias="startedAt")
    completed_at: Optional[datetime] = Field(None, alias="completedAt")
    duration_ms: int = Field(0, alias="durationMs")


class ParserResultModel(BaseModel):
    statement: BankStatementModel
    transactions: List[BankTransactionModel] = Field(default_factory=list)
    summary: ImportSummaryModel
    errors: List[ParserErrorModel] = Field(default_factory=list)
    validation_errors: List[ValidationErrorModel] = Field(default_factory=list, alias="validationErrors")
    is_success: bool = Field(True, alias="isSuccess")
