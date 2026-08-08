import re
from typing import List, Dict, Tuple, Optional
from app.utils.logger import logger

RAW_TO_STANDARD_MAP: Dict[str, List[str]] = {
    "date": [
        "txn date", "transaction date", "value date", "val date", "trans date",
        "posting date", "post date", "tran date", "date", "dt", "trn date"
    ],
    "description": [
        "narration", "particulars", "description", "remarks", "details",
        "transaction details", "transaction remarks", "transaction particulars",
        "narration/particulars", "desc", "summary"
    ],
    "reference": [
        "ref no./cheque no.", "chq./ref.no.", "cheque number", "chqno",
        "chq/ref no", "instrument id", "cheque no", "chq no", "ref no",
        "reference number", "reference no", "chq/ref", "ref/cheque no",
        "reference", "ref", "utr", "txn id", "cheque/ref", "instrument no"
    ],
    "debit": [
        "withdrawal amt.", "withdrawal amount (inr)", "withdrawal (dr)",
        "debit (dr.)", "debit amount", "withdrawal (rs)", "debit (rs)",
        "withdrawal amt", "debit amt", "withdrawals", "debit", "withdrawal",
        "dr amt", "dr (rs)", "dr.", "dr"
    ],
    "credit": [
        "deposit amt.", "deposit amount (inr)", "deposit (cr)",
        "credit (cr.)", "credit amount", "deposit (rs)", "credit (rs)",
        "deposit amt", "credit amt", "deposits", "credit", "deposit",
        "cr amt", "cr (rs)", "cr.", "cr"
    ],
    "single_amount": [
        "amount (inr)", "amount (rs)", "amount (dr/cr)", "amount (cr/dr)",
        "txn amount", "transaction amount", "amount"
    ],
    "type": [
        "type", "txn type", "dr/cr", "cr/dr", "d/c", "c/d", "indicator", "cr/dr/nr"
    ],
    "balance": [
        "closing balance", "running balance", "balance (inr)", "balance (rs)",
        "closing bal", "avail bal", "available balance", "bal (rs)",
        "balance", "bal"
    ],
}


class HeaderDetector:
    """
    Automatic Bank Statement Header Detector for all major Indian Banks.
    Recognizes diverse raw header text variations across SBI, HDFC, ICICI, Axis, Kotak,
    BOB, PNB, Canara, Union, IndusInd, IDFC FIRST, YES Bank, Federal Bank, etc.
    and normalizes them to the 6 standard keys:
    - date
    - description
    - reference
    - debit
    - credit
    - balance
    100% position-independent.
    """

    def normalize_header_text(self, cell_text: str) -> str:
        """Cleans and normalizes raw header text for robust matching."""
        if not cell_text:
            return ""
        text = cell_text.strip().lower()
        text = re.sub(r"[^\w\s/().-]", "", text)
        return re.sub(r"\s+", " ", text).strip()

    def identify_column_standard_name(self, raw_header: str) -> Optional[str]:
        """Maps a raw header cell string to its standard column key."""
        clean = self.normalize_header_text(raw_header)
        if not clean:
            return None

        # Check longest matching keyword first for precision (e.g. "txn date" before "date")
        best_match: Optional[Tuple[str, int]] = None

        for std_key, keywords in RAW_TO_STANDARD_MAP.items():
            for kw in keywords:
                if clean == kw:
                    return std_key
                elif kw in clean:
                    match_len = len(kw)
                    if best_match is None or match_len > best_match[1]:
                        best_match = (std_key, match_len)

        return best_match[0] if best_match else None

    def detect_and_map_headers(
        self, row_cells: List[str]
    ) -> Tuple[Dict[str, int], Dict[int, str], bool]:
        """
        Scans a candidate row of cell strings.
        Returns:
        - standard_to_index: Dict[std_key -> cell_index]
        - index_to_standard: Dict[cell_index -> std_key]
        - is_header_row: True if valid header pattern identified
        """
        standard_to_index: Dict[str, int] = {}
        index_to_standard: Dict[int, str] = {}

        for idx, cell in enumerate(row_cells):
            if cell is None:
                continue
            std_key = self.identify_column_standard_name(str(cell))
            if std_key and std_key not in standard_to_index:
                standard_to_index[std_key] = idx
                index_to_standard[idx] = std_key

        has_date = "date" in standard_to_index
        has_desc = "description" in standard_to_index
        has_amount = any(k in standard_to_index for k in ["debit", "credit", "balance"])

        is_header_row = has_date and (has_desc or has_amount)

        if is_header_row:
            logger.info(f"HeaderDetector mapped Indian Bank header row {row_cells} -> {standard_to_index}")

        return standard_to_index, index_to_standard, is_header_row


header_detector = HeaderDetector()
