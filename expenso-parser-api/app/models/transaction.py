from enum import Enum
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field
from app.models.error import ValidationErrorModel


class TransactionType(str, Enum):
    DEBIT = "debit"
    CREDIT = "credit"


class TransactionConfidence(BaseModel):
    overall: float = 1.0
    date_confidence: float = Field(1.0, alias="dateConfidence")
    amount_confidence: float = Field(1.0, alias="amountConfidence")
    description_confidence: float = Field(1.0, alias="descriptionConfidence")


class BankTransactionModel(BaseModel):
    id: str
    statement_id: str = Field(..., alias="statementId")
    raw_date: str = Field(..., alias="rawDate")
    date: datetime
    raw_description: str = Field(..., alias="rawDescription")
    description: str
    merchant_name: Optional[str] = Field(None, alias="merchantName")
    raw_amount: str = Field(..., alias="rawAmount")
    amount: float
    type: TransactionType
    raw_balance: Optional[str] = Field(None, alias="rawBalance")
    balance: Optional[float] = Field(None)
    category: Optional[str] = Field(None)
    confidence: TransactionConfidence = Field(default_factory=TransactionConfidence)
    is_flagged: bool = Field(False, alias="isFlagged")
    is_duplicate: bool = Field(False, alias="isDuplicate")
    validation_errors: List[ValidationErrorModel] = Field(default_factory=list, alias="validationErrors")
    line_index: int = Field(0, alias="lineIndex")
    page_index: int = Field(0, alias="pageIndex")
