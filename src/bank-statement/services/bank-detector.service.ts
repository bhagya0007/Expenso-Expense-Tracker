import type { BankLayoutConfig } from "../types/bank";

export interface IBankDetectorService {
  detectBankLayout(sampleText: string): BankLayoutConfig;
}

export class BankDetectorService implements IBankDetectorService {
  detectBankLayout(_sampleText: string): BankLayoutConfig {
    throw new Error("Method not implemented. Architectural placeholder.");
  }
}

export const bankDetectorService = new BankDetectorService();
