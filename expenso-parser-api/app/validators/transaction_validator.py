import re
from typing import List
from app.models.transaction import BankTransactionModel
from app.models.error import ValidationErrorModel, ValidationErrorSeverity

REF_FORMAT_PATTERN = re.compile(r"^[A-Za-z0-9/_-]+$")


def validate_transaction(tx: BankTransactionModel) -> List[ValidationErrorModel]:
    """
    Validates Date, Amount, Balance, Debit, Credit, and Reference fields for a transaction row.
    Returns list of ValidationErrorModel objects.
    """
    errors: List[ValidationErrorModel] = []
    
    # 1. Date Validation
    if not tx.raw_date or not tx.raw_date.strip():
        errors.append(
            ValidationErrorModel(
                id=f"val_{tx.id}_date_empty",
                field="date",
                ruleName="NON_EMPTY_DATE",
                message="Transaction raw date string is empty or missing.",
                rawValue=tx.raw_date,
                lineIndex=tx.line_index,
                pageIndex=tx.page_index,
                severity=ValidationErrorSeverity.ERROR,
            )
        )

    # 2. Amount Validation
    if tx.amount <= 0:
        errors.append(
            ValidationErrorModel(
                id=f"val_{tx.id}_amt_zero",
                field="amount",
                ruleName="POSITIVE_AMOUNT",
                message="Transaction monetary amount must be greater than zero.",
                rawValue=tx.raw_amount,
                lineIndex=tx.line_index,
                pageIndex=tx.page_index,
                severity=ValidationErrorSeverity.ERROR,
            )
        )

    # 3. Debit / Credit Validation
    if tx.type not in ["debit", "credit"]:
        errors.append(
            ValidationErrorModel(
                id=f"val_{tx.id}_type_invalid",
                field="type",
                ruleName="VALID_TRANSACTION_TYPE",
                message="Transaction type must be 'debit' or 'credit'.",
                rawValue=str(tx.type),
                lineIndex=tx.line_index,
                pageIndex=tx.page_index,
                severity=ValidationErrorSeverity.ERROR,
            )
        )

    # 4. Description Validation
    if not tx.description or len(tx.description.strip()) < 2:
        errors.append(
            ValidationErrorModel(
                id=f"val_{tx.id}_desc_short",
                field="description",
                ruleName="MIN_DESCRIPTION_LENGTH",
                message="Transaction description is empty or too short.",
                rawValue=tx.description,
                lineIndex=tx.line_index,
                pageIndex=tx.page_index,
                severity=ValidationErrorSeverity.WARNING,
            )
        )

    # 5. Balance Validation (if present)
    if tx.balance is not None and tx.balance < 0:
        errors.append(
            ValidationErrorModel(
                id=f"val_{tx.id}_bal_negative",
                field="balance",
                ruleName="NON_NEGATIVE_BALANCE",
                message="Account balance figure is negative.",
                rawValue=tx.raw_balance,
                lineIndex=tx.line_index,
                pageIndex=tx.page_index,
                severity=ValidationErrorSeverity.WARNING,
            )
        )

    return errors
