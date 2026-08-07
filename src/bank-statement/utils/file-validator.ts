export const MAX_STATEMENT_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

export function validateStatementFile(file: File): { isValid: boolean; error?: string } {
  if (!file) {
    return { isValid: false, error: "No file provided" };
  }
  if (file.size > MAX_STATEMENT_FILE_SIZE_BYTES) {
    return { isValid: false, error: "File size exceeds 15MB limit" };
  }
  const validTypes = ["application/pdf", "image/png", "image/jpeg"];
  if (!validTypes.includes(file.type)) {
    return { isValid: false, error: "Only PDF, PNG, and JPEG bank statement files are supported" };
  }
  return { isValid: true };
}
