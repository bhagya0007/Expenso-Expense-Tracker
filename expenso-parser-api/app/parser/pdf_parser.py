import io
import re
import gc
from typing import Dict, Any, List, Optional, Tuple, Generator
from app.parser.base_parser import BaseParser
from app.parser.header_detector import header_detector
from app.utils.logger import logger

# Regex Date Patterns for Transaction Row Detection
DATE_PATTERNS = [
    re.compile(r"^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}"),
    re.compile(r"^\d{1,2}[-/.\s][A-Za-z]{3}[-/.\s]\d{2,4}", re.IGNORECASE),
    re.compile(r"^\d{1,2}[-/.\s][A-Za-z]{3}[-/.\s]\d{2}", re.IGNORECASE),
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
                    if not tables or all(len(t) < 2 for t in tables):
                        # Try text strategy for gridless / borderless bank statement tables
                        try:
                            tables = page.extract_tables(table_settings={"vertical_strategy": "text", "horizontal_strategy": "text"})
                        except Exception:
                            tables = []

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

    def _clean_and_finalize_row(
        self, row: Dict[str, Any], prev_balance: Optional[float] = None
    ) -> Tuple[Dict[str, Any], Optional[float]]:
        desc = row.get("raw_description", "")
        
        # If debit/credit/balance are already populated from table columns, preserve them
        if row.get("raw_debit") or row.get("raw_credit"):
            row["raw_description"] = re.sub(r"\s+", " ", desc).strip()
            bal_str = row.get("raw_balance", "")
            if bal_str:
                try:
                    bal_val = float(re.sub(r"[^\d.-]", "", str(bal_str).replace(",", "")))
                    return row, bal_val
                except ValueError:
                    pass
            return row, prev_balance

        # Extract monetary floats (numbers with 2 decimal places) from line text
        money_matches = list(re.finditer(r"(-?\d{1,3}(?:,\d{3})*\.\d{2})\s*(Dr|Cr|DR|CR)?", desc))
        if money_matches:
            parsed = []
            for m in reversed(money_matches):
                amt_str = m.group(1).replace(",", "")
                suffix = (m.group(2) or "").upper()
                try:
                    val = float(amt_str)
                    parsed.append((val, suffix, m.start()))
                except ValueError:
                    pass

            if len(parsed) >= 2:
                # Rightmost is balance, second rightmost is transaction amount
                bal_val, _, b_start = parsed[0]
                tx_val, suffix, a_start = parsed[1]
                
                row["raw_balance"] = f"{bal_val:.2f}"
                cut_idx = min(a_start, b_start)
                row["raw_description"] = re.sub(r"\s+", " ", desc[:cut_idx]).strip()

                if suffix == "CR" or (prev_balance is not None and bal_val > prev_balance + 0.01):
                    row["raw_credit"] = f"{tx_val:.2f}"
                    row["raw_debit"] = ""
                else:
                    row["raw_debit"] = f"{tx_val:.2f}"
                    row["raw_credit"] = ""

                return row, bal_val
            elif len(parsed) == 1:
                tx_val, suffix, a_start = parsed[0]
                row["raw_description"] = re.sub(r"\s+", " ", desc[:a_start]).strip()
                if suffix == "CR":
                    row["raw_credit"] = f"{tx_val:.2f}"
                    row["raw_debit"] = ""
                else:
                    row["raw_debit"] = f"{tx_val:.2f}"
                    row["raw_credit"] = ""
                return row, prev_balance

        row["raw_description"] = re.sub(r"\s+", " ", desc).strip()
        return row, prev_balance

    def _extract_tables_with_fitz(self, file_bytes: bytes) -> Dict[str, Any]:
        rows_result: List[Dict[str, Any]] = []
        detected_headers: List[str] = ["Date", "Description", "Debit", "Credit", "Balance"]

        try:
            import fitz

            doc = fitz.open(stream=file_bytes, filetype="pdf")
            current_row: Optional[Dict[str, Any]] = None
            line_counter = 1
            last_bal: Optional[float] = None

            for page_idx, page in enumerate(doc, start=1):
                text_lines = page.get_text().split("\n")
                for line in text_lines:
                    line_str = line.strip()
                    if not line_str:
                        continue

                    is_date_row = any(pat.match(line_str) for pat in DATE_PATTERNS)
                    
                    if is_date_row:
                        if current_row:
                            finalized, last_bal = self._clean_and_finalize_row(current_row, last_bal)
                            rows_result.append(finalized)
                        
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
                finalized, last_bal = self._clean_and_finalize_row(current_row, last_bal)
                rows_result.append(finalized)

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
        raw_single_amt = get_val("single_amount")
        raw_type = get_val("type")

        # Handle Single Amount column statements (Kotak, Federal, Wise, Revolut, etc.)
        if raw_single_amt and not raw_debit and not raw_credit:
            combined_type = f"{raw_type} {raw_single_amt}".upper()
            if "CR" in combined_type or "CREDIT" in combined_type or "DEPOSIT" in combined_type:
                raw_credit = raw_single_amt
            elif "DR" in combined_type or "DEBIT" in combined_type or "WITHDRAWAL" in combined_type:
                raw_debit = raw_single_amt
            else:
                raw_debit = raw_single_amt

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
            for page in doc[:3]:
                sample_text += page.get_text() + " "
            doc.close()

            # Bank patterns: (compiled_regex, bank_id, display_name)
            # More specific patterns first, short abbreviations last
            bank_patterns = [
                (re.compile(r"\bHDFC\s+BANK\b", re.IGNORECASE), "hdfc", "HDFC Bank"),
                (re.compile(r"\bHDFC\b", re.IGNORECASE), "hdfc", "HDFC Bank"),
                (re.compile(r"\bICICI\s+BANK\b", re.IGNORECASE), "icici", "ICICI Bank"),
                (re.compile(r"\bICICI\b", re.IGNORECASE), "icici", "ICICI Bank"),
                (re.compile(r"\bSTATE\s+BANK\s+OF\s+INDIA\b", re.IGNORECASE), "sbi", "State Bank of India"),
                (re.compile(r"\bAXIS\s+BANK\b", re.IGNORECASE), "axis", "Axis Bank"),
                (re.compile(r"\bAXIS\b", re.IGNORECASE), "axis", "Axis Bank"),
                (re.compile(r"\bKOTAK\s+MAHINDRA\b", re.IGNORECASE), "kotak", "Kotak Mahindra Bank"),
                (re.compile(r"\bKOTAK\b", re.IGNORECASE), "kotak", "Kotak Mahindra Bank"),
                (re.compile(r"\bPUNJAB\s+NATIONAL\s+BANK\b", re.IGNORECASE), "pnb", "Punjab National Bank"),
                (re.compile(r"\bBANK\s+OF\s+BARODA\b", re.IGNORECASE), "bob", "Bank of Baroda"),
                (re.compile(r"\bCANARA\s+BANK\b", re.IGNORECASE), "canara", "Canara Bank"),
                (re.compile(r"\bUNION\s+BANK\b", re.IGNORECASE), "union", "Union Bank of India"),
                (re.compile(r"\bIDBI\s+BANK\b", re.IGNORECASE), "idbi", "IDBI Bank"),
                (re.compile(r"\bYES\s+BANK\b", re.IGNORECASE), "yesbank", "Yes Bank"),
                (re.compile(r"\bINDUSIND\b", re.IGNORECASE), "indusind", "IndusInd Bank"),
                (re.compile(r"\bFEDERAL\s+BANK\b", re.IGNORECASE), "federal", "Federal Bank"),
                (re.compile(r"\bINDIAN\s+BANK\b", re.IGNORECASE), "indianbank", "Indian Bank"),
                (re.compile(r"\bBANDHAN\s+BANK\b", re.IGNORECASE), "bandhan", "Bandhan Bank"),
                (re.compile(r"\bCENTRAL\s+BANK\s+OF\s+INDIA\b", re.IGNORECASE), "centralbank", "Central Bank of India"),
                (re.compile(r"\bBANK\s+OF\s+INDIA\b", re.IGNORECASE), "boi", "Bank of India"),
                (re.compile(r"\bUCO\s+BANK\b", re.IGNORECASE), "uco", "UCO Bank"),
                (re.compile(r"\bPNB\b", re.IGNORECASE), "pnb", "Punjab National Bank"),
                (re.compile(r"\bIOB\b", re.IGNORECASE), "iob", "Indian Overseas Bank"),
                (re.compile(r"\bSBI\b", re.IGNORECASE), "sbi", "State Bank of India"),
            ]

            for pat, bid, bname in bank_patterns:
                if pat.search(sample_text):
                    logger.info(f"Digital PDF bank identity detected: {bname}")
                    return bid, bname

            # Dynamic Extraction: search top text lines for any line containing "Bank"
            for line in sample_text.split("\n")[:25]:
                line_str = line.strip()
                match = re.search(r"\b([A-Za-z0-9\s&'-]{2,30}\s+BANK(?: [A-Za-z0-9\.-]+)?)\b", line_str, re.IGNORECASE)
                if match:
                    extracted = match.group(1).strip()
                    cleaned = re.sub(r"^(Welcome|Statement|Account|Branch|Dear|The)\s+", "", extracted, flags=re.IGNORECASE).strip()
                    if 4 <= len(cleaned) <= 45:
                        bank_id = re.sub(r"[^a-z0-9]", "", cleaned.lower())[:15] or "bank"
                        logger.info(f"Dynamic bank name extracted from PDF header: '{cleaned}'")
                        return bank_id, cleaned.title()

        except Exception as e:
            logger.warning(f"_detect_bank_identity warning: {str(e)}")

        return "bank_statement", "Bank Statement"
