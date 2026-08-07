import hashlib
from typing import List, Set, Tuple
from app.models.transaction import BankTransactionModel
from app.utils.logger import logger


class DuplicateDetector:
    """
    Deduplication Engine for Bank Transactions.
    Generates SHA-256 fingerprints based on:
    - Date (YYYY-MM-DD)
    - Reference / Description
    - Amount
    - Balance
    
    Prevents duplicate imports both within a single statement and across historical imports.
    """

    def generate_transaction_fingerprint(self, tx: BankTransactionModel) -> str:
        date_part = tx.date.strftime("%Y-%m-%d") if tx.date else tx.raw_date
        desc_ref_part = (tx.description or "").strip().upper()
        amount_part = f"{tx.amount:.2f}"
        balance_part = f"{tx.balance:.2f}" if tx.balance is not None else "0.00"

        raw_fingerprint_string = f"{date_part}|{desc_ref_part}|{amount_part}|{balance_part}"
        return hashlib.sha256(raw_fingerprint_string.encode("utf-8")).hexdigest()

    def filter_duplicate_transactions(
        self,
        transactions: List[BankTransactionModel],
        existing_fingerprints: Set[str] = None
    ) -> Tuple[List[BankTransactionModel], List[BankTransactionModel], int]:
        """
        Filters duplicate transactions out.
        Returns:
        - unique_transactions: List of new unique transactions to import
        - duplicate_transactions: List of duplicate transactions flagged
        - duplicates_count: Count of duplicates skipped
        """
        seen_fingerprints: Set[str] = set(existing_fingerprints) if existing_fingerprints else set()
        unique_transactions: List[BankTransactionModel] = []
        duplicate_transactions: List[BankTransactionModel] = []
        duplicates_count = 0

        for tx in transactions:
            fp = self.generate_transaction_fingerprint(tx)
            
            if fp in seen_fingerprints:
                tx.is_duplicate = True
                tx.is_flagged = True
                duplicate_transactions.append(tx)
                duplicates_count += 1
                logger.info(f"Duplicate transaction detected at line {tx.line_index}: '{tx.description}' ({tx.amount})")
            else:
                seen_fingerprints.add(fp)
                unique_transactions.append(tx)

        return unique_transactions, duplicate_transactions, duplicates_count


duplicate_detector = DuplicateDetector()
