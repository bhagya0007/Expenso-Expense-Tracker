import re
from typing import List, Dict, Any, Optional, Tuple
from app.utils.logger import logger

DATE_PATTERNS = [
    re.compile(r"^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}"),
    re.compile(r"^\d{1,2}[-\s][A-Za-z]{3}[-\s]\d{2,4}", re.IGNORECASE),
    re.compile(r"^[A-Za-z]{3}\s+\d{1,2},\s+\d{4}", re.IGNORECASE),
    re.compile(r"\b\d{2}/\d{2}/\d{4}\b"),
    re.compile(r"^\d{1,2}\.\d{1,2}\.\d{2,4}"),
]

# Strict: must have decimal point (e.g. 1,234.56)
NUMERIC_AMOUNT_PATTERN = re.compile(r"^-?[\d,]+\.\d{2}$")
# Loose: allow amounts without decimal but cap at 10 digits to avoid matching
# UPI reference numbers (which are 12+ digit strings)
NUMERIC_AMOUNT_LOOSE = re.compile(r"^-?[\d,]{1,10}(?:\.\d{1,2})?$")
# Reference number pattern: long digit-only strings (10+ digits, no decimal)
REFERENCE_NUMBER_PATTERN = re.compile(r"^\d{10,}$")


class SpatialRowReconstructor:
    """
    Coordinate-Based Spatial Row Reconstructor for Scattered OCR Bounding Boxes.

    Principles:
    1. Y-axis Coordinate Line Clustering: Groups scattered words into visual lines
       using dynamic height-based tolerance.
    2. X-axis Column Boundary Detection: Detects table column boundaries from
       header row bounding boxes, then assigns words to Date / Description /
       Reference / Debit / Credit / Balance fields by X-coordinate range.
    3. Multiline Narration Merging: Combines wrapped narration continuation lines
       into one transaction record. Never generates synthetic rows.
    4. Strict Original Document Order: Processes pages and rows top-to-bottom.
    """

    def reconstruct_rows(
        self, bbox_words: List[Dict[str, Any]], page_idx: int = 1
    ) -> List[Dict[str, Any]]:
        if not bbox_words:
            return []

        # 1. Cluster words into visual lines based on Y-coordinate bounding boxes
        lines = self._cluster_words_into_lines(bbox_words)

        # 2. Detect column boundaries from header-like lines
        column_boundaries = self._detect_column_boundaries(lines)

        # 3. Reconstruct transaction records
        transaction_rows: List[Dict[str, Any]] = []
        active_record: Optional[Dict[str, Any]] = None
        line_counter = 1

        for line in lines:
            # Sort words horizontally left-to-right
            sorted_line_words = sorted(line, key=lambda w: w["box"][0])
            line_text = " ".join(w["text"] for w in sorted_line_words).strip()

            if not line_text:
                continue

            # Skip header-like lines
            if self._is_header_line(line_text):
                line_counter += 1
                continue

            # Check for date anchor
            date_match = self._find_date_anchor(line_text)

            if date_match:
                # Rule: NEW TRANSACTION ANCHOR — flush previous record
                if active_record:
                    active_record["raw_description"] = re.sub(
                        r"\s+", " ", active_record["raw_description"]
                    ).strip()
                    transaction_rows.append(active_record)

                date_val, remaining_text = date_match

                # Extract structured fields using column boundaries
                if column_boundaries:
                    fields = self._assign_fields_by_columns(
                        sorted_line_words, column_boundaries
                    )
                else:
                    fields = self._extract_fields_heuristic(sorted_line_words)

                active_record = {
                    "line_index": line_counter,
                    "page_index": page_idx,
                    "raw_date": date_val,
                    "raw_description": fields.get("description", remaining_text),
                    "raw_ref": fields.get("reference", ""),
                    "raw_debit": fields.get("debit", ""),
                    "raw_credit": fields.get("credit", ""),
                    "raw_balance": fields.get("balance", ""),
                }
            elif active_record:
                # Rule: MULTILINE NARRATION CONTINUATION
                # Check if this line has amounts that belong to the active record
                if column_boundaries:
                    fields = self._assign_fields_by_columns(
                        sorted_line_words, column_boundaries
                    )
                else:
                    fields = self._extract_fields_heuristic(sorted_line_words)

                # Append text-only words to description
                desc_addition = fields.get("description", line_text)
                if desc_addition:
                    active_record["raw_description"] += f" {desc_addition}"

                # Fill in missing amounts from continuation lines
                if fields.get("debit") and not active_record["raw_debit"]:
                    active_record["raw_debit"] = fields["debit"]
                if fields.get("credit") and not active_record["raw_credit"]:
                    active_record["raw_credit"] = fields["credit"]
                if fields.get("balance") and not active_record["raw_balance"]:
                    active_record["raw_balance"] = fields["balance"]
                if fields.get("reference") and not active_record["raw_ref"]:
                    active_record["raw_ref"] = fields["reference"]

            line_counter += 1

        # Flush last record
        if active_record:
            active_record["raw_description"] = re.sub(
                r"\s+", " ", active_record["raw_description"]
            ).strip()
            transaction_rows.append(active_record)

        logger.info(
            f"SpatialRowReconstructor reconstructed {len(transaction_rows)} "
            f"transaction rows from {len(bbox_words)} scattered OCR bounding "
            f"boxes on page {page_idx}"
        )
        return transaction_rows

    # ── Line Clustering ──────────────────────────────────────────────

    def _cluster_words_into_lines(
        self, bbox_words: List[Dict[str, Any]]
    ) -> List[List[Dict[str, Any]]]:
        """Clusters scattered 2D bounding boxes into horizontal visual lines."""
        sorted_words = sorted(bbox_words, key=lambda w: (w["box"][1], w["box"][0]))
        lines: List[List[Dict[str, Any]]] = []

        for word in sorted_words:
            y1, y2 = word["box"][1], word["box"][3]
            word_height = max(1.0, y2 - y1)
            y_center = (y1 + y2) / 2.0

            placed = False
            for line in lines:
                line_y_center = (
                    sum((w["box"][1] + w["box"][3]) / 2.0 for w in line) / len(line)
                )
                tolerance = max(8.0, word_height * 0.55)

                if abs(line_y_center - y_center) <= tolerance:
                    line.append(word)
                    placed = True
                    break

            if not placed:
                lines.append([word])

        return lines

    # ── Column Boundary Detection ────────────────────────────────────

    HEADER_KEYWORDS = {
        "date": "date",
        "txn date": "date",
        "value date": "date",
        "transaction date": "date",
        "narration": "description",
        "description": "description",
        "particulars": "description",
        "details": "description",
        "ref": "reference",
        "ref no": "reference",
        "reference": "reference",
        "chq": "reference",
        "chq no": "reference",
        "cheque": "reference",
        "debit": "debit",
        "withdrawal": "debit",
        "dr": "debit",
        "debit(rs)": "debit",
        "debit (rs)": "debit",
        "debit amount": "debit",
        "credit": "credit",
        "deposit": "credit",
        "cr": "credit",
        "credit(rs)": "credit",
        "credit (rs)": "credit",
        "credit amount": "credit",
        "balance": "balance",
        "closing balance": "balance",
        "balance (rs)": "balance",
        "balance(rs)": "balance",
        "running balance": "balance",
    }

    def _detect_column_boundaries(
        self, lines: List[List[Dict[str, Any]]]
    ) -> Dict[str, Tuple[float, float]]:
        """
        Scans the first few visual lines to detect header keywords and
        their X-coordinate boundaries.  Returns a dict mapping column role
        to (x_start, x_end) pixel range.
        """
        for line in lines[:8]:
            sorted_words = sorted(line, key=lambda w: w["box"][0])
            line_text = " ".join(w["text"] for w in sorted_words).strip().lower()

            # Quick check: does this line contain at least 2 header keywords?
            matches = sum(1 for kw in self.HEADER_KEYWORDS if kw in line_text)
            if matches < 2:
                continue

            boundaries: Dict[str, Tuple[float, float]] = {}
            for word in sorted_words:
                word_text = word["text"].strip().lower()
                # Try single word match
                role = self.HEADER_KEYWORDS.get(word_text)
                if not role:
                    # Try two-word combinations with neighbors
                    for other in sorted_words:
                        if other is word:
                            continue
                        combined = f"{word_text} {other['text'].strip().lower()}"
                        role = self.HEADER_KEYWORDS.get(combined)
                        if role:
                            break

                if role and role not in boundaries:
                    boundaries[role] = (word["box"][0], word["box"][2])

            if len(boundaries) >= 2:
                logger.info(
                    f"Column boundaries detected: "
                    f"{', '.join(f'{k}=[{v[0]:.0f}-{v[1]:.0f}]' for k, v in boundaries.items())}"
                )
                return boundaries

        return {}

    # ── Field Assignment ─────────────────────────────────────────────

    def _assign_fields_by_columns(
        self,
        line_words: List[Dict[str, Any]],
        col_bounds: Dict[str, Tuple[float, float]],
    ) -> Dict[str, str]:
        """Assigns each word to a column based on X-coordinate overlap."""
        fields: Dict[str, List[str]] = {
            "description": [],
            "reference": [],
            "debit": [],
            "credit": [],
            "balance": [],
        }

        # Expand column ranges by ±30% of their width for tolerance
        expanded: Dict[str, Tuple[float, float]] = {}
        for role, (x1, x2) in col_bounds.items():
            w = max(x2 - x1, 20)
            expanded[role] = (x1 - w * 0.3, x2 + w * 0.3)

        for word in line_words:
            wx_center = (word["box"][0] + word["box"][2]) / 2.0
            text = word["text"].strip()
            if not text:
                continue

            # Skip date words (already extracted)
            if any(p.match(text) for p in DATE_PATTERNS):
                continue

            assigned = False
            for role in ["debit", "credit", "balance", "reference"]:
                if role in expanded:
                    x1, x2 = expanded[role]
                    if x1 <= wx_center <= x2:
                        fields[role].append(text)
                        assigned = True
                        break

            if not assigned:
                # Default to description
                fields["description"].append(text)

        return {
            "description": " ".join(fields["description"]),
            "reference": " ".join(fields["reference"]),
            "debit": " ".join(fields["debit"]),
            "credit": " ".join(fields["credit"]),
            "balance": " ".join(fields["balance"]),
        }

    def _is_monetary_amount(self, text: str) -> bool:
        """Returns True if the text looks like a monetary amount, not a reference number."""
        cleaned = text.replace(",", "").strip()
        # Must have a decimal point for larger numbers
        if NUMERIC_AMOUNT_PATTERN.match(cleaned):
            return True
        # Small numbers without decimal are OK (e.g. "500", "1000")
        if NUMERIC_AMOUNT_LOOSE.match(cleaned):
            digits_only = re.sub(r"[^\d]", "", cleaned)
            # If it's more than 7 digits without a decimal point, it's likely a ref number
            if len(digits_only) > 7 and "." not in cleaned:
                return False
            return True
        return False

    def _extract_fields_heuristic(
        self, line_words: List[Dict[str, Any]]
    ) -> Dict[str, str]:
        """Fallback: extracts amounts from rightmost numeric tokens.
        Uses X-position to identify rightmost numbers as amounts
        and mid-table long digit strings as reference numbers."""
        text_parts: List[str] = []
        amount_words: List[Dict[str, Any]] = []  # (word, x_center)
        ref_candidate = ""

        for word in line_words:
            text = word["text"].strip()
            if not text:
                continue
            cleaned = text.replace(",", "").strip()

            # Skip date words
            if any(p.match(text) for p in DATE_PATTERNS):
                continue

            # Check if it's a long pure-digit reference number
            if REFERENCE_NUMBER_PATTERN.match(cleaned):
                ref_candidate = text
                continue

            # Check if it's a monetary amount
            if self._is_monetary_amount(text):
                amount_words.append(word)
            else:
                text_parts.append(text)

        # Sort amount words by X position (leftmost first)
        amount_words.sort(key=lambda w: w["box"][0])
        amounts = [w["text"].strip() for w in amount_words]

        debit, credit, balance = "", "", ""
        if len(amounts) == 1:
            debit = amounts[0]
        elif len(amounts) == 2:
            debit = amounts[0]
            balance = amounts[1]
        elif len(amounts) >= 3:
            debit = amounts[0]
            credit = amounts[1]
            balance = amounts[2]

        return {
            "description": " ".join(text_parts),
            "reference": ref_candidate,
            "debit": debit,
            "credit": credit,
            "balance": balance,
        }

    # ── Helpers ───────────────────────────────────────────────────────

    def _find_date_anchor(self, text: str) -> Optional[Tuple[str, str]]:
        """Identifies if a text line starts with a transaction date anchor."""
        for pattern in DATE_PATTERNS:
            match = pattern.search(text)
            if match and match.start() < 10:
                date_str = match.group(0)
                remaining = text[match.end() :].strip()
                return date_str, remaining
        return None

    def _is_header_line(self, text: str) -> bool:
        """Returns True if the line looks like a table header."""
        t = text.lower()
        header_count = sum(1 for kw in self.HEADER_KEYWORDS if kw in t)
        return header_count >= 2


spatial_reconstructor = SpatialRowReconstructor()
