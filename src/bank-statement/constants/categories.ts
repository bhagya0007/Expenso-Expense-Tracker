export const DEFAULT_STATEMENT_CATEGORIES = [
  "Food",
  "Shopping",
  "Bills",
  "Travel",
  "Salary",
  "Entertainment",
  "Uncategorized",
] as const;

export type StatementCategory = (typeof DEFAULT_STATEMENT_CATEGORIES)[number];
