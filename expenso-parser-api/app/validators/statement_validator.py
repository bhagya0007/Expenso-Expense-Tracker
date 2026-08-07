from typing import List
from app.models.statement import BankStatementModel
from app.models.transaction import BankTransactionModel, TransactionType
from app.models.error import ValidationErrorModel, ValidationErrorSeverity
from app.utils.logger import logger


def validate_transaction_sequence_continuity(
    transactions: List[BankTransactionModel]
) -> List[ValidationErrorModel]:
    """
    Validates sequential balance continuity across transactions:
    Previous Balance +/- Current Amount = Next Balance.
    
    Detects impossible balance values without inventing or modifying numbers.
    """
    errors: List[ValidationErrorModel] = []
    
    if len(transactions) < 2:
        return errors

    for i in range(1, len(transactions)):
        prev_tx = transactions[i - 1]
        curr_tx = transactions[i]

        if prev_tx.balance is not None and curr_tx.balance is not None:
            prev_bal = round(prev_tx.balance, 2)
            curr_bal = round(curr_tx.balance, 2)
            curr_amt = round(curr_tx.amount, 2)

            if curr_tx.type == TransactionType.CREDIT:
                expected_bal = round(prev_bal + curr_amt, 2)
            else:
                expected_bal = round(prev_bal - curr_amt, 2)

            diff = abs(expected_bal - curr_bal)

            if diff > 0.01:
                err_msg = (
                    f"Transaction balance continuity discrepancy at line {curr_tx.line_index}: "
                    f"Previous balance ({prev_bal}) {'+' if curr_tx.type == TransactionType.CREDIT else '-'} "
                    f"amount ({curr_amt}) = expected ({expected_bal}), but statement shows ({curr_bal}). "
                    f"Difference: {diff:.2f}"
                )
                logger.warning(err_msg)
                
                curr_tx.is_flagged = True
                errors.append(
                    ValidationErrorModel(
                        id=f"val_{curr_tx.id}_seq_bal",
                        field="balance",
                        ruleName="TRANSACTION_SEQUENCE_CONTINUITY",
                        message=err_msg,
                        rawValue=str(curr_tx.raw_balance),
                        lineIndex=curr_tx.line_index,
                        pageIndex=curr_tx.page_index,
                        severity=ValidationErrorSeverity.WARNING,
                    )
                )

    return errors


def validate_statement_balance(
    statement: BankStatementModel,
    transactions: List[BankTransactionModel]
) -> List[ValidationErrorModel]:
    """Validates statement opening/closing balance and transaction sequence continuity."""
    errors: List[ValidationErrorModel] = []

    if statement.opening_balance is not None and statement.closing_balance is not None:
        calc_debits = sum(t.amount for t in transactions if t.type == TransactionType.DEBIT)
        calc_credits = sum(t.amount for t in transactions if t.type == TransactionType.CREDIT)
        expected_closing = round(statement.opening_balance + calc_credits - calc_debits, 2)
        actual_closing = round(statement.closing_balance, 2)

        if abs(expected_closing - actual_closing) > 0.01:
            errors.append(
                ValidationErrorModel(
                    id="val_stmt_balance",
                    field="closingBalance",
                    ruleName="BALANCE_CONTINUITY_CHECK",
                    message=f"Calculated closing balance ({expected_closing}) does not match statement closing balance ({actual_closing}).",
                    rawValue=str(actual_closing),
                    lineIndex=None,
                    pageIndex=None,
                    severity=ValidationErrorSeverity.WARNING,
                )
            )

    seq_errors = validate_transaction_sequence_continuity(transactions)
    errors.extend(seq_errors)

    return errors
