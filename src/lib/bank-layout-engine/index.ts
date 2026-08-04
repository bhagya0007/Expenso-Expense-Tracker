import type { IBankLayoutParser, BankLayoutParseResult } from "./types";
import { SBILayoutParser } from "./sbi";
import { HDFCLayoutParser } from "./hdfc";
import { ICICILayoutParser } from "./icici";
import { GenericLayoutParser } from "./generic";

export * from "./types";
export * from "./sbi";
export * from "./hdfc";
export * from "./icici";
export * from "./generic";

export class BankLayoutDetectionEngine {
  private parsers: IBankLayoutParser[] = [];
  private fallbackParser: IBankLayoutParser = new GenericLayoutParser();

  constructor() {
    // Register initial Indian Bank Layout Strategies
    this.registerBankParser(new SBILayoutParser());
    this.registerBankParser(new HDFCLayoutParser());
    this.registerBankParser(new ICICILayoutParser());
  }

  /**
   * Registers a new bank layout strategy.
   * Allows adding more banks dynamically without modifying existing bank classes or core engine logic!
   */
  public registerBankParser(parser: IBankLayoutParser): void {
    this.parsers.push(parser);
  }

  /**
   * Automatically detects the bank statement layout based on headers, column names,
   * transaction patterns, and statement structure, then executes the matching parser strategy.
   */
  public detectAndParse(lines: string[]): BankLayoutParseResult {
    let bestParser: IBankLayoutParser = this.fallbackParser;
    let highestScore = 0;

    for (const parser of this.parsers) {
      const score = parser.detectMatch(lines);
      if (score > highestScore) {
        highestScore = score;
        bestParser = parser;
      }
    }

    // Require at least 0.35 confidence match to use specific bank strategy over generic
    if (highestScore < 0.35) {
      bestParser = this.fallbackParser;
    }

    return bestParser.parseLayout(lines);
  }
}

export const bankLayoutEngine = new BankLayoutDetectionEngine();
