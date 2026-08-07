import { useState, useCallback } from "react";
import type { StatementProcessingState, StatementParseResult } from "../types";

export interface UseStatementParserReturn {
  state: StatementProcessingState;
  result: StatementParseResult | null;
  parseStatement: (file: File) => Promise<void>;
  resetParser: () => void;
}

export function useStatementParser(): UseStatementParserReturn {
  const [state, setState] = useState<StatementProcessingState>({
    status: "idle",
    progressPercentage: 0,
  });
  const [result, setResult] = useState<StatementParseResult | null>(null);

  const parseStatement = useCallback(async (_file: File) => {
    setState({
      status: "parsing_transactions",
      progressPercentage: 50,
      currentStepMessage: "Parsing architectural placeholder...",
    });
    // Parsing placeholder workflow
  }, []);

  const resetParser = useCallback(() => {
    setState({ status: "idle", progressPercentage: 0 });
    setResult(null);
  }, []);

  return { state, result, parseStatement, resetParser };
}
