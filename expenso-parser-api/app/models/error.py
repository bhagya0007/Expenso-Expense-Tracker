from enum import Enum
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class ValidationErrorSeverity(str, Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class ParserErrorCode(str, Enum):
    UNSUPPORTED_FILE_TYPE = "UNSUPPORTED_FILE_TYPE"
    FILE_TOO_LARGE = "FILE_TOO_LARGE"
    PASSWORD_PROTECTED = "PASSWORD_PROTECTED"
    OCR_ENGINE_FAILURE = "OCR_ENGINE_FAILURE"
    TEXT_EXTRACTION_FAILED = "TEXT_EXTRACTION_FAILED"
    UNKNOWN_BANK_LAYOUT = "UNKNOWN_BANK_LAYOUT"
    NO_TRANSACTIONS_FOUND = "NO_TRANSACTIONS_FOUND"
    INVALID_ROW_FORMAT = "INVALID_ROW_FORMAT"
    BALANCE_MISMATCH = "BALANCE_MISMATCH"


class ValidationErrorModel(BaseModel):
    id: str
    field: str
    rule_name: str = Field(..., alias="ruleName")
    message: str
    raw_value: Optional[str] = Field(None, alias="rawValue")
    line_index: Optional[int] = Field(None, alias="lineIndex")
    page_index: Optional[int] = Field(None, alias="pageIndex")
    severity: ValidationErrorSeverity


class ParserErrorModel(BaseModel):
    code: ParserErrorCode
    message: str
    stage: str
    line_index: Optional[int] = Field(None, alias="lineIndex")
    page_index: Optional[int] = Field(None, alias="pageIndex")
    raw_snippet: Optional[str] = Field(None, alias="rawSnippet")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    is_fatal: bool = Field(True, alias="isFatal")
