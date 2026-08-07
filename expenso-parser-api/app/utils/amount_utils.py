import re
from typing import Tuple


def clean_currency_amount(amount_str: str) -> Tuple[float, str]:
    if not amount_str:
        return 0.0, "debit"
        
    cleaned = re.sub(r"[^\d.-]", "", amount_str)
    try:
        val = float(cleaned)
        tx_type = "credit" if "cr" in amount_str.lower() or val > 0 else "debit"
        return abs(val), tx_type
    except ValueError:
        return 0.0, "debit"
