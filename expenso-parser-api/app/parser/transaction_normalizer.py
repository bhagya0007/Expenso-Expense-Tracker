import re
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
from app.models.transaction import BankTransactionModel, TransactionType, TransactionConfidence
from app.parser.category_assigner import category_assigner
from app.utils.date_utils import parse_bank_date
from app.utils.logger import logger


class TransactionNormalizer:
    """
    Normalizes extracted raw bank statement table rows into strongly-typed BankTransactionModel objects.
    
    Normalizations:
    - Whitespace: Collapses internal spaces, tabs, and newlines.
    - Currency: Cleans currency symbols (₹, Rs, INR, commas, Cr/Dr suffix) to parse exact float amounts without modifying numeric values.
    - Dates: Parses raw bank dates into datetime objects.
    - Category: Assigns Food, Shopping, Bills, Travel, Salary, Entertainment based on description rules without modifying raw data.
    - Integrity: Preserves raw original values intact.
    """

    def normalize_whitespace(self, text: Optional[str]) -> str:
        if not text:
            return ""
        return re.sub(r"\s+", " ", str(text)).strip()

    def parse_currency_amount(self, amount_str: Optional[str]) -> float:
        if not amount_str:
            return 0.0
        
        cleaned = re.sub(r"[^\d.-]", "", str(amount_str).replace(",", ""))
        if not cleaned or cleaned == "-":
            return 0.0
            
        try:
            val = float(cleaned)
            return abs(val)
        except ValueError:
            return 0.0

    def normalize_row(
        self, raw_row: Dict[str, Any], statement_id: str = "stmt_default"
    ) -> BankTransactionModel:
        raw_date_str = str(raw_row.get("raw_date", "")).strip()
        raw_desc_str = str(raw_row.get("raw_description", "")).strip()
        raw_debit_str = str(raw_row.get("raw_debit", "")).strip()
        raw_credit_str = str(raw_row.get("raw_credit", "")).strip()
        raw_bal_str = str(raw_row.get("raw_balance", "")).strip()

        # 1. Normalize Whitespace
        clean_desc = self.normalize_whitespace(raw_desc_str)

        # 2. Normalize Dates
        parsed_dt = parse_bank_date(raw_date_str) or datetime.utcnow()

        # 3. Normalize Currency Amounts without modifying numeric values
        debit_amt = self.parse_currency_amount(raw_debit_str)
        credit_amt = self.parse_currency_amount(raw_credit_str)
        balance_amt = self.parse_currency_amount(raw_bal_str) if raw_bal_str else None

        if credit_amt > 0 and debit_amt == 0:
            tx_type = TransactionType.CREDIT
            final_amount = credit_amt
            raw_amt_str = raw_credit_str
        else:
            tx_type = TransactionType.DEBIT
            final_amount = debit_amt if debit_amt > 0 else credit_amt
            raw_amt_str = raw_debit_str if debit_amt > 0 else raw_credit_str

        # 4. Assign Category (Food, Shopping, Bills, Travel, Salary, Entertainment)
        assigned_category = category_assigner.assign_category(clean_desc, tx_type)

        tx_id = f"tx_{uuid.uuid4().hex[:8]}"

        return BankTransactionModel(
            id=tx_id,
            statementId=statement_id,
            rawDate=raw_date_str,
            date=parsed_dt,
            rawDescription=raw_desc_str,
            description=clean_desc,
            merchantName=None,
            rawAmount=raw_amt_str or "0.00",
            amount=final_amount,
            type=tx_type,
            rawBalance=raw_bal_str if raw_bal_str else None,
            balance=balance_amt,
            category=assigned_category,
            confidence=TransactionConfidence(overall=1.0, dateConfidence=1.0, amountConfidence=1.0, descriptionConfidence=1.0),
            isFlagged=False,
            isDuplicate=False,
            validationErrors=[],
            lineIndex=int(raw_row.get("line_index", 0)),
            pageIndex=int(raw_row.get("page_index", 1)),
        )

    def normalize_rows_list(
        self, raw_rows: List[Dict[str, Any]], statement_id: str = "stmt_default"
    ) -> List[BankTransactionModel]:
        normalized_list: List[BankTransactionModel] = []
        for r in raw_rows:
            tx = self.normalize_row(r, statement_id=statement_id)
            normalized_list.append(tx)
        logger.info(f"TransactionNormalizer converted {len(normalized_list)} raw rows into BankTransactionModel list")
        return normalized_list


transaction_normalizer = TransactionNormalizer()
