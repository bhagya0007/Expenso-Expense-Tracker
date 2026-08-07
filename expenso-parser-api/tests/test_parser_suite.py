import sys
from pathlib import Path
from typing import Dict, Any, List

# Add parent app directory to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.parser.header_detector import header_detector
from app.parser.transaction_normalizer import transaction_normalizer
from app.validators.transaction_validator import validate_transaction
from app.validators.statement_validator import validate_transaction_sequence_continuity
from app.validators.duplicate_detector import duplicate_detector


def run_comprehensive_parser_tests():
    print("==================================================================")
    print("         EXPENSO PARSER API - COMPREHENSIVE TEST SUITE            ")
    print("==================================================================")

    test_cases = [
        {
            "bank": "HDFC Bank",
            "type": "Digital PDF",
            "headers": ["Txn Date", "Value Date", "Narration", "Chq/Ref No", "Withdrawal Amt", "Deposit Amt", "Closing Balance"],
            "raw_row": {
                "line_index": 1,
                "page_index": 1,
                "raw_date": "01/08/2026",
                "raw_description": "UPI-SWIGGY-PAYMENT [Ref: 123456789]",
                "raw_debit": "450.00",
                "raw_credit": "",
                "raw_balance": "14550.00"
            },
            "expected_amount": 450.0,
            "expected_type": "debit"
        },
        {
            "bank": "State Bank of India (SBI)",
            "type": "Digital PDF",
            "headers": ["Txn Date", "Value Date", "Description", "Ref No", "Debit", "Credit", "Balance"],
            "raw_row": {
                "line_index": 2,
                "page_index": 1,
                "raw_date": "02/08/2026",
                "raw_description": "NEFT-SALARY-CREDIT-AUG",
                "raw_debit": "",
                "raw_credit": "15000.00",
                "raw_balance": "29550.00"
            },
            "expected_amount": 15000.0,
            "expected_type": "credit"
        },
        {
            "bank": "ICICI Bank",
            "type": "Digital PDF",
            "headers": ["Date", "Transaction Particulars", "Withdrawal (Dr)", "Deposit (Cr)", "Balance (INR)"],
            "raw_row": {
                "line_index": 3,
                "page_index": 1,
                "raw_date": "03/08/2026",
                "raw_description": "POS AMAZON INDIA RETAIL",
                "raw_debit": "1800.00",
                "raw_credit": "",
                "raw_balance": "27750.00"
            },
            "expected_amount": 1800.0,
            "expected_type": "debit"
        },
        {
            "bank": "Axis Bank",
            "type": "Digital PDF",
            "headers": ["Tran Date", "CHQNO", "PARTICULARS", "DR", "CR", "BAL"],
            "raw_row": {
                "line_index": 4,
                "page_index": 1,
                "raw_date": "04/08/2026",
                "raw_description": "ELECTRICITY BILL PAYMENT BESCOM",
                "raw_debit": "1200.00",
                "raw_credit": "",
                "raw_balance": "26550.00"
            },
            "expected_amount": 1200.0,
            "expected_type": "debit"
        },
        {
            "bank": "Kotak Mahindra Bank",
            "type": "Scanned PDF (OCR)",
            "headers": ["Date", "Narration", "Amount (Dr/Cr)", "Balance"],
            "raw_row": {
                "line_index": 5,
                "page_index": 1,
                "raw_date": "05/08/2026",
                "raw_description": "NETFLIX DIGITAL SUBSCRIPTION",
                "raw_debit": "649.00",
                "raw_credit": "",
                "raw_balance": "25901.00"
            },
            "expected_amount": 649.0,
            "expected_type": "debit"
        },
        {
            "bank": "Canara Bank",
            "type": "Scanned PDF (OCR)",
            "headers": ["Date", "Particulars", "Debit", "Credit", "Balance"],
            "raw_row": {
                "line_index": 6,
                "page_index": 1,
                "raw_date": "06/08/2026",
                "raw_description": "UBER RIDES TRAVEL BENGALURU",
                "raw_debit": "350.00",
                "raw_credit": "",
                "raw_balance": "25551.00"
            },
            "expected_amount": 350.0,
            "expected_type": "debit"
        },
    ]

    total_tests = len(test_cases)
    passed_tests = 0
    results_summary = []

    for tc in test_cases:
        bank_name = tc["bank"]
        pdf_type = tc["type"]
        
        # 1. Test Header Detection
        header_map, _, is_header = header_detector.detect_and_map_headers(tc["headers"])
        
        # 2. Test Transaction Normalizer
        tx = transaction_normalizer.normalize_row(tc["raw_row"])
        
        # 3. Test Validation
        val_errors = validate_transaction(tx)
        fatal_errors = [e for e in val_errors if e.severity.value == "ERROR"]

        # Evaluate correctness
        header_pass = is_header
        amount_pass = tx.amount == tc["expected_amount"]
        type_pass = tx.type.value == tc["expected_type"]
        validation_pass = len(fatal_errors) == 0

        case_passed = header_pass and amount_pass and type_pass and validation_pass
        if case_passed:
            passed_tests += 1

        status_str = "PASSED" if case_passed else "FAILED"
        print(f"[{status_str}] {bank_name} ({pdf_type}) -> Category: {tx.category}, Amt: {tx.amount}, Type: {tx.type.value}")

        results_summary.append({
            "bank": bank_name,
            "type": pdf_type,
            "status": status_str,
            "accuracy": "100%" if case_passed else "0%",
            "category": tx.category,
        })

    accuracy_pct = round((passed_tests / total_tests) * 100, 1)

    print("------------------------------------------------------------------")
    print(f"TOTAL TESTS: {total_tests} | PASSED: {passed_tests} | ACCURACY: {accuracy_pct}%")
    print("==================================================================")

    return accuracy_pct, results_summary


if __name__ == "__main__":
    run_comprehensive_parser_tests()
