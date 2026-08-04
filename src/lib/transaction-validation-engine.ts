/**
 * Transaction Validation Engine.
 *
 * Validation Rules:
 * ✓ Valid Date (non-null, valid ISO date)
 * ✓ Valid Amount (positive, finite number)
 * ✓ Debit and Credit cannot both contain non-null values
 * ✓ Remove duplicate rows while preserving original order
 * ✓ Flag & isolate invalid rows in `errors[]` without mutating valid transactions
 */

import type { StrictExtractedTransaction, ParsingError } from "./transaction-extraction-engine";

export interface TransactionValidationResult {
  transactions: StrictExtractedTransaction[];
  errors: ParsingError[];
}

/**
 * Validates extracted transactions against financial integrity rules.
 */
export function validateExtractedTransactions(
  rawTransactions: StrictExtractedTransaction[],
  initialErrors: ParsingError[] = []
): TransactionValidationResult {
  const validTransactions: StrictExtractedTransaction[] = [];
  const errors: ParsingError[] = [...initialErrors];
  const seenSignatures = new Set<string>();

  for (let i = 0; i < rawTransactions.length; i++) {
    const tx = rawTransactions[i];
    const rawRepresentation = `Date: ${tx.date || "N/A"} | Desc: ${tx.description} | Debit: ${tx.debit} | Credit: ${tx.credit} | Bal: ${tx.balance}`;

    // Rule 1: Valid Date
    if (!tx.date || isNaN(+new Date(tx.date))) {
      errors.push({
        rawLine: rawRepresentation,
        lineIndex: i + 1,
        reason: `Invalid transaction date: "${tx.date}"`,
      });
      continue;
    }

    // Rule 2: Valid Amount (At least one must be a positive finite number)
    const validDebit = tx.debit !== null && isFinite(tx.debit) && tx.debit > 0;
    const validCredit = tx.credit !== null && isFinite(tx.credit) && tx.credit > 0;

    if (!validDebit && !validCredit) {
      errors.push({
        rawLine: rawRepresentation,
        lineIndex: i + 1,
        reason: "Transaction has no valid positive debit or credit amount",
      });
      continue;
    }

    // Rule 3: Debit and Credit CANNOT both contain values
    if (validDebit && validCredit) {
      errors.push({
        rawLine: rawRepresentation,
        lineIndex: i + 1,
        reason: "Conflict: Transaction contains both debit AND credit values simultaneously",
      });
      continue;
    }

    // Rule 4: Deduplication (Keep first occurrence, preserve original order)
    const signature = `${tx.date}_${tx.description.toLowerCase().trim()}_${tx.debit ?? ""}_${tx.credit ?? ""}_${tx.balance ?? ""}`;
    if (seenSignatures.has(signature)) {
      // Duplicate row detected — skip without adding to valid list
      continue;
    }

    seenSignatures.add(signature);

    // Rule 5: Pass validation — append unmodified valid transaction preserving order
    validTransactions.push(tx);
  }

  return {
    transactions: validTransactions,
    errors,
  };
}
