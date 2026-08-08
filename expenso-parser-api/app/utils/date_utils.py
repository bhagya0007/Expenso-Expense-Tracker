from datetime import datetime
from typing import Optional


def parse_bank_date(date_str: str) -> Optional[datetime]:
    if not date_str or not date_str.strip():
        return None
        
    date_str = date_str.strip()
    formats = [
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%d.%m.%Y",
        "%d/%m/%y",
        "%d-%m-%y",
        "%d.%m.%y",
        "%d-%b-%Y",
        "%d-%b-%y",
        "%d %b %Y",
        "%d %b %y",
        "%b %d, %Y",
        "%d %b, %Y",
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%d/%b/%Y",
        "%d/%b/%y",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    return None
