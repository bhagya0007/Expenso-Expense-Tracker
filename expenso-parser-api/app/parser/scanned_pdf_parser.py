import re
from typing import Dict, Any, List
from app.parser.base_parser import BaseParser
from app.ocr.ocr_engine import PaddleOcrEngine
from app.utils.logger import logger


# Bank identification: (regex_pattern, bank_id, display_name)
# Order matters: more-specific patterns first, short abbreviations last.
_BANK_IDENTIFIERS = [
    (r"\bHDFC\s+BANK\b", "hdfc", "HDFC Bank"),
    (r"\bHDFC\b", "hdfc", "HDFC Bank"),
    (r"\bICICI\s+BANK\b", "icici", "ICICI Bank"),
    (r"\bICICI\b", "icici", "ICICI Bank"),
    (r"\bSTATE\s+BANK\s+OF\s+INDIA\b", "sbi", "State Bank of India"),
    (r"\bAXIS\s+BANK\b", "axis", "Axis Bank"),
    (r"\bKOTAK\s+MAHINDRA\b", "kotak", "Kotak Mahindra Bank"),
    (r"\bKOTAK\b", "kotak", "Kotak Mahindra Bank"),
    (r"\bPUNJAB\s+NATIONAL\s+BANK\b", "pnb", "Punjab National Bank"),
    (r"\bBANK\s+OF\s+BARODA\b", "bob", "Bank of Baroda"),
    (r"\bCANARA\s+BANK\b", "canara", "Canara Bank"),
    (r"\bUNION\s+BANK\b", "union", "Union Bank of India"),
    (r"\bIDBI\s+BANK\b", "idbi", "IDBI Bank"),
    (r"\bYES\s+BANK\b", "yesbank", "Yes Bank"),
    (r"\bINDUSIND\b", "indusind", "IndusInd Bank"),
    (r"\bFEDERAL\s+BANK\b", "federal", "Federal Bank"),
    (r"\bINDIAN\s+BANK\b", "indianbank", "Indian Bank"),
    (r"\bBANDHAN\s+BANK\b", "bandhan", "Bandhan Bank"),
    (r"\bCENTRAL\s+BANK\s+OF\s+INDIA\b", "centralbank", "Central Bank of India"),
    (r"\bBANK\s+OF\s+INDIA\b", "boi", "Bank of India"),
    (r"\bUCO\s+BANK\b", "uco", "UCO Bank"),
    (r"\bPNB\b", "pnb", "Punjab National Bank"),
    (r"\bIOB\b", "iob", "Indian Overseas Bank"),
    (r"\bSBI\b", "sbi", "State Bank of India"),
]

# Pre-compile patterns
_COMPILED_BANK_PATTERNS = [
    (re.compile(pat, re.IGNORECASE), bid, bname)
    for pat, bid, bname in _BANK_IDENTIFIERS
]


class ScannedPdfParser(BaseParser):
    """
    Scanned PDF Parser powered by PyMuPDF (300 DPI rendering),
    OpenCV 6-step preprocessing, PaddleOCR / RapidOCR / EasyOCR,
    and coordinate-based spatial table reconstruction.

    Supports multi-page scanned bank statement PDFs.
    Never generates fake or synthetic transactions.
    """

    def __init__(self, ocr_engine: PaddleOcrEngine = None):
        self.ocr_engine = ocr_engine or PaddleOcrEngine()

    def parse_content(self, file_bytes: bytes, file_name: str) -> Dict[str, Any]:
        logger.info(
            f"ScannedPdfParser analyzing '{file_name}' ({len(file_bytes)} bytes)"
        )

        # Run multi-page OCR extraction + spatial table reconstruction
        ocr_result = self.ocr_engine.process_scanned_pdf_bytes(file_bytes)
        rows = ocr_result.get("rows", [])

        logger.info(
            f"ScannedPdfParser extracted {len(rows)} transaction rows "
            f"using engine '{ocr_result.get('engine', 'unknown')}'"
        )

        # Detect bank identity from all OCR text (headers, footers, logos, descriptions)
        all_ocr_text = ocr_result.get("all_ocr_text", "")
        bank_id, bank_name = self._detect_bank_from_ocr_text(all_ocr_text, file_name)

        return {
            "bank_id": bank_id,
            "bank_name": bank_name,
            "detected_headers": [
                "Date", "Description", "Reference", "Debit", "Credit", "Balance"
            ],
            "rows": rows,
        }

    def _detect_bank_from_ocr_text(
        self, all_ocr_text: str, file_name: str
    ) -> tuple:
        """
        Detects bank identity by scanning all OCR-extracted text
        (headers, footers, logos, transaction descriptions)
        and the filename for known bank keywords using word-boundary regex.
        """
        combined_text = file_name + " " + all_ocr_text

        for pattern, bank_id, bank_name in _COMPILED_BANK_PATTERNS:
            if pattern.search(combined_text):
                logger.info(f"Bank detected from OCR text: {bank_name}")
                return bank_id, bank_name

        # Dynamic Extraction: search OCR text for any phrase containing "Bank"
        match = re.search(r"\b([A-Za-z0-9\s&'-]{2,30}\s+BANK(?: [A-Za-z0-9\.-]+)?)\b", combined_text, re.IGNORECASE)
        if match:
            extracted = match.group(1).strip()
            cleaned = re.sub(r"^(Welcome|Statement|Account|Branch|Dear|The)\s+", "", extracted, flags=re.IGNORECASE).strip()
            if 4 <= len(cleaned) <= 45:
                bank_id = re.sub(r"[^a-z0-9]", "", cleaned.lower())[:15] or "bank"
                logger.info(f"Dynamic bank name extracted from OCR text: '{cleaned}'")
                return bank_id, cleaned.title()

        return "bank_statement", "Bank Statement"

