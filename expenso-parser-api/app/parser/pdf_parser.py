import io
import re
import gc
from typing import Dict, Any, List, Optional, Tuple, Generator
from app.parser.base_parser import BaseParser
from app.parser.header_detector import header_detector
from app.utils.logger import logger

# Regex Date Patterns for Transaction Row Detection
DATE_PATTERNS = [
    re.compile(r"^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}"),
    re.compile(r"^\d{1,2}[-\s][A-Za-z]{3}[-\s]\d{2,4}", re.IGNORECASE),
    re.compile(r"^[A-Za-z]{3}\s+\d{1,2},\s+\d{4}", re.IGNORECASE),
]


class PdfParser(BaseParser):
    """
    Digital PDF Table Parser powered by PyMuPDF (fitz) & pdfplumber.
    Dynamically detects headers, column roles, and multiline transaction rows
    without using fixed column indexes. Returns structured table data only.
    Optimized for high parsing speed, low memory usage, page generator streaming, and large PDFs.
    """

    def parse_content(self, file_bytes: bytes, file_name: str) -> Dict[str, Any]:
        logger.info(f"Digital PdfParser analyzing '{file_name}' ({len(file_bytes)} bytes)")

        # 1. Try extracting tables using pdfplumber or fitz
        extracted_tables = self._extract_tables_with_pdfplumber(file_bytes)
        
        if not extracted_tables or not extracted_tables.get("rows"):
            logger.info("Falling back to PyMuPDF text stream line parser...")
            extracted_tables = self._extract_tables_with_fitz(file_bytes)

        # 2. Detect Bank ID from overall text
        bank_id, bank_name = self._detect_bank_identity(file_bytes)

        return {
            "bank_id": bank_id,
            "bank_name": bank_name,
            "detected_headers": extracted_tables.get("headers", []),
            "rows": extracted_tables.get("rows", []),
        }

    def parse_pages_generator(self, file_bytes: bytes) -> Generator[List[Dict[str, Any]], None, None]:
        """
        Memory-optimized generator streaming transaction rows page by page.
        Forces gc.collect() every 10 pages for large PDFs.
        """
        import fitz
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        
        try:
            line_counter = 1
            for page_idx, page in enumerate(doc, start=1):
                page_rows: List[Dict[str, Any]] = []
                text_lines = page.get_text("text").split("\n")
                current_row: Optional[Dict[str, Any]] = None

                for line in text_lines:
                    line_str = line.strip()
                    if not line_str:
                        continue

                    is_date_row = any(pat.match(line_str) for pat in DATE_PATTERNS)
                    
                    if is_date_row:
                        if current_row:
                            current_row["raw_description"] = re.sub(r"\s+", " ", current_row["raw_description"]).strip()
                            page_rows.append(current_row)
                        
                        tokens = line_str.split(maxsplit=1)
                        date_val = tokens[0] if tokens else line_str
                        desc_val = tokens[1] if len(tokens) > 1 else ""

                        current_row = {
                            "line_index": line_counter,
                            "page_index": page_idx,
                            "raw_date": date_val,
                            "raw_description": desc_val,
                            "raw_debit": "",
                            "raw_credit": "",
                            "raw_balance": "",
                        }
                    elif current_row:
                        current_row["raw_description"] += f" {line_str}"

                    line_counter += 1

                if current_row:
                    current_row["raw_description"] = re.sub(r"\s+", " ", current_row["raw_description"]).strip()
                    page_rows.append(current_row)

                yield page_rows

                # Garbage collection per 10 pages for large PDFs
                if page_idx % 10 == 0:
                    gc.collect()

        finally:
            doc.close()
            gc.collect()

    def _extract_tables_with_pdfplumber(self, file_bytes: bytes) -> Dict[str, Any]:
        rows_result: List[Dict[str, Any]] = []
        detected_headers: List[str] = []

        try:
            import pdfplumber

            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                for page_idx, page in enumerate(pdf.pages, start=1):
                    tables = page.extract_tables()
                    for table in tables:
                        if not table or len(table) < 2:
                            continue
                        
                        header_map, header_row_idx = self._find_header_mapping(table)
                        if header_map and not detected_headers:
                            detected_headers = [str(c) for c in table[header_row_idx] if c]

                        current_row: Optional[Dict[str, Any]] = None
                        start_idx = (header_row_idx + 1) if header_map else 0

                        for row_idx, row in enumerate(table[start_idx:], start=1):
                            if not row or all(c is None or str(c).strip() == "" for c in row):
                                continue

                            parsed_row = self._parse_single_table_row(row, header_map, page_idx, row_idx)
                            if not parsed_row:
                                continue

                            if parsed_row.get("raw_date"):
                                if current_row:
                                    current_row["raw_description"] = re.sub(r"\s+", " ", current_row["raw_description"]).strip()
                                    rows_result.append(current_row)
                                current_row = parsed_row
                            elif current_row and parsed_row.get("raw_description"):
                                current_row["raw_description"] += f" {parsed_row['raw_description']}"
                                if parsed_row.get("raw_debit") and not current_row.get("raw_debit"):
                                    current_row["raw_debit"] = parsed_row["raw_debit"]
                                if parsed_row.get("raw_credit") and not current_row.get("raw_credit"):
                                    current_row["raw_credit"] = parsed_row["raw_credit"]
                                if parsed_row.get("raw_balance") and not current_row.get("raw_balance"):
                                    current_row["raw_balance"] = parsed_row["raw_balance"]

                        if current_row:
                            current_row["raw_description"] = re.sub(r"\s+", " ", current_row["raw_description"]).strip()
                            rows_result.append(current_row)

                    if page_idx % 10 == 0:
                        gc.collect()

        except Exception as e:
            logger.warning(f"pdfplumber table extraction failed ({str(e)}). Retrying with PyMuPDF fallback.")
            return {}

        return {"headers": detected_headers, "rows": rows_result}

    def _extract_tables_with_fitz(self, file_bytes: bytes) -> Dict[str, Any]:
        rows_result: List[Dict[str, Any]] = []
        detected_headers: List[str] = ["Date", "Description", "Debit", "Credit", "Balance"]

        try:
            import fitz

            doc = fitz.open(stream=file_bytes, filetype="pdf")
            current_row: Optional[Dict[str, Any]] = None
            line_counter = 1

            for page_idx, page in enumerate(doc, start=1):
                text_lines = page.get_text().split("\n")
                for line in text_lines:
                    line_str = line.strip()
                    if not line_str:
                        continue

                    is_date_row = any(pat.match(line_str) for pat in DATE_PATTERNS)
                    
                    if is_date_row:
                        if current_row:
                            current_row["raw_description"] = re.sub(r"\s+", " ", current_row["raw_description"]).strip()
                            rows_result.append(current_row)
                        
                        tokens = line_str.split(maxsplit=1)
                        date_val = tokens[0] if tokens else line_str
                        desc_val = tokens[1] if len(tokens) > 1 else ""

                        current_row = {
                            "line_index": line_counter,
                            "page_index": page_idx,
                            "raw_date": date_val,
                            "raw_description": desc_val,
                            "raw_debit": "",
                            "raw_credit": "",
                            "raw_balance": "",
                        }
                    elif current_row:
                        current_row["raw_description"] += f" {line_str}"

                    line_counter += 1

                if page_idx % 10 == 0:
                    gc.collect()

            if current_row:
                current_row["raw_description"] = re.sub(r"\s+", " ", current_row["raw_description"]).strip()
                rows_result.append(current_row)

            doc.close()
            gc.collect()

        except Exception as e:
            logger.error(f"PyMuPDF fallback parsing error: {str(e)}")

        return {"headers": detected_headers, "rows": rows_result}

    def _find_header_mapping(self, table: List[List[Any]]) -> Tuple[Dict[str, int], int]:
        for row_idx, row in enumerate(table[:5]):
            if not row:
                continue
            
            row_str_cells = [str(cell) if cell is not None else "" for cell in row]
            standard_to_index, _, is_header = header_detector.detect_and_map_headers(row_str_cells)

            if is_header:
                return standard_to_index, row_idx

        return {}, 0

    def _parse_single_table_row(
        self,
        row: List[Any],
        header_map: Dict[str, int],
        page_idx: int,
        row_idx: int,
    ) -> Optional[Dict[str, Any]]:
        def get_val(role: str) -> str:
            if role in header_map:
                idx = header_map[role]
                if idx < len(row) and row[idx] is not None:
                    return str(row[idx]).strip()
            return ""

        raw_date = get_val("date")
        raw_desc = get_val("description")
        raw_debit = get_val("debit")
        raw_credit = get_val("credit")
        raw_balance = get_val("balance")
        raw_ref = get_val("reference")

        if raw_ref and raw_desc:
            raw_desc = f"{raw_desc} [Ref: {raw_ref}]"
        elif raw_ref and not raw_desc:
            raw_desc = f"Ref: {raw_ref}"

        if not header_map:
            non_empty_cells = [str(c).strip() for c in row if c is not None and str(c).strip() != ""]
            if not non_empty_cells:
                return None
            
            if any(pat.match(non_empty_cells[0]) for pat in DATE_PATTERNS):
                raw_date = non_empty_cells[0]
                raw_desc = non_empty_cells[1] if len(non_empty_cells) > 1 else ""
                if len(non_empty_cells) > 2:
                    raw_debit = non_empty_cells[2]
                if len(non_empty_cells) > 3:
                    raw_balance = non_empty_cells[-1]
            else:
                raw_desc = " ".join(non_empty_cells)

        return {
            "line_index": row_idx,
            "page_index": page_idx,
            "raw_date": raw_date,
            "raw_description": raw_desc,
            "raw_debit": raw_debit,
            "raw_credit": raw_credit,
            "raw_balance": raw_balance,
        }

    def _detect_bank_identity(self, file_bytes: bytes) -> Tuple[str, str]:
        try:
            import fitz
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            sample_text = ""
            for page in doc[:2]:
                sample_text += page.get_text() + " "
            doc.close()
            sample_upper = sample_text.upper()

            if "STATE BANK OF INDIA" in sample_upper or "SBI" in sample_upper:
                return "sbi", "State Bank of India"
            elif "HDFC BANK" in sample_upper or "HDFC" in sample_upper:
                return "hdfc", "HDFC Bank"
            elif "ICICI BANK" in sample_upper or "ICICI" in sample_upper:
                return "icici", "ICICI Bank"
            elif "AXIS BANK" in sample_upper or "AXIS" in sample_upper:
                return "axis", "Axis Bank"
            elif "KOTAK" in sample_upper:
                return "kotak", "Kotak Mahindra Bank"
        except Exception:
            pass

        return "generic", "Generic Indian Bank"
