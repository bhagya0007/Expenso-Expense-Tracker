export function normalizeBankDate(dateStr: string): Date | null {
  if (!dateStr || !dateStr.trim()) return null;
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}
