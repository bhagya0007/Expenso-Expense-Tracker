import type { StatementParseResult, StatementProcessingState } from "../types";

export interface IBankStatementParserService {
  parseFile(
    file: File,
    onProgress?: (state: StatementProcessingState) => void
  ): Promise<StatementParseResult>;
}

export class BankStatementParserService implements IBankStatementParserService {
  async parseFile(
    _file: File,
    _onProgress?: (state: StatementProcessingState) => void
  ): Promise<StatementParseResult> {
    throw new Error("Method not implemented. Architectural placeholder.");
  }
}

export const statementParserService = new BankStatementParserService();
