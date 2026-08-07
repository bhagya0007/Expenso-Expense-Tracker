import sys
from pathlib import Path
from typing import Dict, Any, List

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.parser.header_detector import header_detector
from app.parser.transaction_normalizer import transaction_normalizer
from app.parser.category_assigner import category_assigner
from app.validators.transaction_validator import validate_transaction
from app.validators.statement_validator import validate_transaction_sequence_continuity
from app.validators.duplicate_detector import duplicate_detector
from app.services.analytics_service import analytics_service


def run_hdfc_and_demo_statement_verification():
    print("==================================================================")
    print("         EXPENSO PARSER API - LIVE DEMO STATEMENT AUDIT           ")
    print("==================================================================")

    # 1. Real HDFC Bank Statement Data (from user uploaded PDF 1)
    hdfc_raw_rows = [
        {"line_index": 1, "page_index": 1, "raw_date": "16/09/2025", "raw_description": "UPI-ABHINAV624PTYES-ABHINAV.624@PTYES-YESBY1100158-525972263779-UPI", "raw_ref": "525972263779", "raw_debit": "50.00", "raw_credit": "0.00", "raw_balance": "19,835.74"},
        {"line_index": 2, "page_index": 1, "raw_date": "17/09/2025", "raw_description": "UPI-KUMAR MANJEET-PAYTMQR69WTQY@PTYS-YESB0PTMUPI-526001818003-UPI", "raw_ref": "526001818003", "raw_debit": "98.00", "raw_credit": "0.00", "raw_balance": "19,737.74"},
        {"line_index": 3, "page_index": 1, "raw_date": "17/09/2025", "raw_description": "UPI-ARYAN SAINI-SAINIARYAN.SRE@OKAXIS-SBIN0004538-56262291267-UPI", "raw_ref": "56262291267", "raw_debit": "0.00", "raw_credit": "44.00", "raw_balance": "19,781.74"},
        {"line_index": 4, "page_index": 1, "raw_date": "22/09/2025", "raw_description": "UPI-FLIPKART-FLIPKART.11YPG@YESPAY-YESB0YESUPI-526503528626-UPIPAY", "raw_ref": "526503528626", "raw_debit": "484.00", "raw_credit": "0.00", "raw_balance": "19,297.74"},
        {"line_index": 5, "page_index": 1, "raw_date": "25/09/2025", "raw_description": "UPI-BABALU KUMAR-Q414324096@YBL-YESB0YBLUPI-526805261115-UPI", "raw_ref": "526805261115", "raw_debit": "30.00", "raw_credit": "0.00", "raw_balance": "19,267.74"},
        {"line_index": 6, "page_index": 1, "raw_date": "25/09/2025", "raw_description": "UPI-PRANJAL SHARMA-PRANJALSHARMA142006@IBL-SBIN0017581-381017170181-PAYMENT FROM PHONE", "raw_ref": "381017170181", "raw_debit": "0.00", "raw_credit": "30.00", "raw_balance": "19,297.74"},
        {"line_index": 7, "page_index": 1, "raw_date": "26/09/2025", "raw_description": "UPI-BABALU KUMAR-Q875965365@YBL-YESB0YBLUPI-563517826548-PAID VIA SUPERMONE", "raw_ref": "563517826548", "raw_debit": "40.00", "raw_credit": "0.00", "raw_balance": "19,257.74"},
        {"line_index": 8, "page_index": 1, "raw_date": "26/09/2025", "raw_description": "UPI-YASMEEN BEGAM-Q827036721@YBL-YESB0YVBLUPI-563517832018-PAID VIA SUPERMONE", "raw_ref": "563517832018", "raw_debit": "30.00", "raw_credit": "0.00", "raw_balance": "19,227.74"},
        {"line_index": 9, "page_index": 1, "raw_date": "26/09/2025", "raw_description": "UPI-PRANJAL SHARMA-PRANJALSHARMA142006@IBL-SBIN0017581-521660688558-PAYMENT FROM PHONE", "raw_ref": "521660688558", "raw_debit": "0.00", "raw_credit": "70.00", "raw_balance": "19,297.74"},
        {"line_index": 10, "page_index": 1, "raw_date": "28/09/2025", "raw_description": "UPI-ARVIND-PAYTMQR5DBRYG@PTYS-YESB0PTMUPI-111855620427-UPI", "raw_ref": "111855620427", "raw_debit": "20.00", "raw_credit": "0.00", "raw_balance": "19,277.74"},
        {"line_index": 11, "page_index": 1, "raw_date": "28/09/2025", "raw_description": "ACH D- LIC OF INDIA-2985702120925", "raw_ref": "003151042369", "raw_debit": "2321.00", "raw_credit": "0.00", "raw_balance": "16,956.74"},
        {"line_index": 12, "page_index": 1, "raw_date": "28/09/2025", "raw_description": "UPI-MR DEVANSH GUPTA-9358140140@AXL-CBIN0280272-111898240131-UPI", "raw_ref": "111898240131", "raw_debit": "100.00", "raw_credit": "0.00", "raw_balance": "16,856.74"},
        {"line_index": 13, "page_index": 1, "raw_date": "29/09/2025", "raw_description": "UPI-DEVANSH GUPTA-9358140140.WALLET@PHONEPE-PPIW0882027-606188286735-FROM PHONE M PHONE", "raw_ref": "606188286735", "raw_debit": "0.00", "raw_credit": "100.00", "raw_balance": "16,956.74"},
        {"line_index": 14, "page_index": 1, "raw_date": "29/09/2025", "raw_description": "UPI-AARADHYA GIFTS AND S-GPAY-11256389761@OKBIZAXIS-UTIB0000553-111939695477-UPI", "raw_ref": "111939695477", "raw_debit": "24.00", "raw_credit": "0.00", "raw_balance": "16,932.74"},
        {"line_index": 15, "page_index": 1, "raw_date": "29/09/2025", "raw_description": "UPI-ARVIND-PAYTMQR5DBRYG@PTYS-YESB0PTMUPI-111947147195-UPI", "raw_ref": "111947147195", "raw_debit": "20.00", "raw_credit": "0.00", "raw_balance": "16,912.74"},
        {"line_index": 16, "page_index": 1, "raw_date": "30/09/2025", "raw_description": "UPI-MONI-9667835035@PTYES-KKBK0005340-111970385736-UPI", "raw_ref": "111970385736", "raw_debit": "20.00", "raw_credit": "0.00", "raw_balance": "16,892.74"},
        {"line_index": 17, "page_index": 1, "raw_date": "30/09/2025", "raw_description": "UPI-DMRC-CF_DMRC2@CASHFREE-NSPB0000011-527307169052-AUTOPAY", "raw_ref": "527307169052", "raw_debit": "50.00", "raw_credit": "0.00", "raw_balance": "16,842.74"},
        {"line_index": 18, "page_index": 1, "raw_date": "30/09/2025", "raw_description": "UPI-JAY KUMAR-BHARATPE.9NO0UG7V4S753356@FBPE-FDRL0001382-111974983578-PAY TO BHARATPE ME", "raw_ref": "111974983578", "raw_debit": "48.00", "raw_credit": "0.00", "raw_balance": "16,794.74"},
        {"line_index": 19, "page_index": 1, "raw_date": "01/10/2025", "raw_description": "INTEREST PAID TILL 30-SEP-2025", "raw_ref": "", "raw_debit": "0.00", "raw_credit": "152.00", "raw_balance": "16,946.74"},
        {"line_index": 20, "page_index": 1, "raw_date": "02/10/2025", "raw_description": "UPI-FLIPKART-FLIPKART.HYPG@YESPAY-YESBOYUSUPL-527537993210-REFUND FOR 6PMN5XL", "raw_ref": "527537993210", "raw_debit": "0.00", "raw_credit": "239.00", "raw_balance": "17,185.74"},
        {"line_index": 21, "page_index": 1, "raw_date": "05/10/2025", "raw_description": "UPI-MR RAJENDRA SINGH-7275545773@PTYES-IDIB000D046-112208578739-UPI", "raw_ref": "112208578739", "raw_debit": "112.00", "raw_credit": "0.00", "raw_balance": "17,073.74"},
        {"line_index": 22, "page_index": 2, "raw_date": "07/10/2025", "raw_description": "UPI-RENU SHARMA-PAYTMQR6HW7I5@PTYS-YESB0PTMUPI-112305882761-UPI", "raw_ref": "112305882761", "raw_debit": "10.00", "raw_credit": "0.00", "raw_balance": "17,063.74"},
        {"line_index": 23, "page_index": 2, "raw_date": "09/10/2025", "raw_description": "UPIRET-20250914-111242756492", "raw_ref": "", "raw_debit": "0.00", "raw_credit": "1.00", "raw_balance": "17,064.74"},
        {"line_index": 24, "page_index": 2, "raw_date": "09/10/2025", "raw_description": "UPI-ZEPTO-ZEPTOONLINE@YBL-YESB0YBLUPI-112395801479-UPI", "raw_ref": "112395801479", "raw_debit": "165.00", "raw_credit": "0.00", "raw_balance": "16,899.74"},
    ]

    print("\n--- [AUDIT 1] HDFC BANK STATEMENT (BHAGYA VARSHNEY) ---")
    normalized_hdfc = transaction_normalizer.normalize_rows_list(hdfc_raw_rows, statement_id="stmt_hdfc_demo")
    
    total_debits = sum(t.amount for t in normalized_hdfc if t.type.value == "debit")
    total_credits = sum(t.amount for t in normalized_hdfc if t.type.value == "credit")
    
    print(f"Total Rows Extracted: {len(normalized_hdfc)}")
    print(f"Total Debits: {total_debits:.2f} INR (Statement summary shows: 3,622.00 INR)")
    print(f"Total Credits: {total_credits:.2f} INR (Statement summary shows: 636.00 INR)")
    print(f"Final Balance: {normalized_hdfc[-1].balance:.2f} INR (Statement summary shows: 16,899.74 INR)")

    balance_exact_match = abs(normalized_hdfc[-1].balance - 16899.74) < 0.01
    debit_sum_match = abs(total_debits - 3622.00) < 0.01
    credit_sum_match = abs(total_credits - 636.00) < 0.01

    print(f"\nExact Balance Match: {'100% MATCH' if balance_exact_match else 'MISMATCH'}")
    print(f"Total Debits Match: {'100% MATCH' if debit_sum_match else 'MISMATCH'}")
    print(f"Total Credits Match: {'100% MATCH' if credit_sum_match else 'MISMATCH'}")

    report = analytics_service.analyze_transactions(normalized_hdfc)
    print("\nGenerated Financial Analytics:")
    print(f"Savings Rate: {report['monthlySummary']['savingsRatePercentage']}%")
    print(f"Category Breakdown: {report['monthlySummary']['categoryBreakdown']}")

    print("\n==================================================================")
    print(f"AUDIT VERIFICATION RESULT: {'100% PERFECT ACCURACY' if (balance_exact_match and debit_sum_match and credit_sum_match) else 'FAILED'}")
    print("==================================================================")


if __name__ == "__main__":
    run_hdfc_and_demo_statement_verification()
