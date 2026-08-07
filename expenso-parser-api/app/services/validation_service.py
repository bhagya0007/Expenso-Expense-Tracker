from typing import List, Tuple
from app.models.statement import BankStatementModel
from app.models.transaction import BankTransactionModel
from app.models.error import ValidationErrorModel, ValidationErrorSeverity
from app.validators.transaction_validator import validate_transaction
from app.validators.statement_validator import validate_statement_balance
from app.utils.logger import logger


class ValidationService:
    def validate_parsed_data(
        self, statement: BankStatementModel, transactions: List[BankTransactionModel]
    ) -> Tuple[List[BankTransactionModel], List[ValidationErrorModel], int]:
        """
        Validates individual transaction rows and statement balance continuity.
        Isolates invalid rows without rejecting the entire bank statement.
        
        Returns:
        - valid_transactions: List of valid BankTransactionModel objects
        - all_validation_errors: List of all validation error models
        - rejected_rows_count: Number of rejected invalid rows
        """
        logger.info(f"ValidationService evaluating statement {statement.id} with {len(transactions)} rows")
        valid_transactions: List[BankTransactionModel] = []
        all_validation_errors: List[ValidationErrorModel] = []
        rejected_rows_count = 0
        
        for tx in transactions:
            row_errors = validate_transaction(tx)
            
            # Check if row has any fatal ERROR severity validation failures
            has_fatal_error = any(e.severity == ValidationErrorSeverity.ERROR for e in row_errors)
            
            if row_errors:
                tx.validation_errors.extend(row_errors)
                tx.is_flagged = True
                all_validation_errors.extend(row_errors)
                
            if has_fatal_error:
                # Quarantined / rejected individual invalid row only
                rejected_rows_count += 1
                logger.warning(f"Quarantined invalid row {tx.id} (line {tx.line_index}): {[e.message for e in row_errors]}")
            else:
                # Retain valid row
                valid_transactions.append(tx)
                
        # Running statement-level balance continuity check across valid rows
        balance_errors = validate_statement_balance(statement, valid_transactions)
        all_validation_errors.extend(balance_errors)
        
        return valid_transactions, all_validation_errors, rejected_rows_count
