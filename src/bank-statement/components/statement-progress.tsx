import type { ReactElement } from "react";
import { Progress } from "@/components/ui/progress";

export interface StatementProgressProps {
  progressPercentage: number;
  message?: string;
}

export function StatementProgress({ progressPercentage, message }: StatementProgressProps): ReactElement {
  return (
    <div className="space-y-2 p-4 rounded-xl border border-border/60 bg-card/40">
      <div className="flex items-center justify-between text-xs font-medium">
        <span>{message || "Processing statement..."}</span>
        <span>{progressPercentage}%</span>
      </div>
      <Progress value={progressPercentage} className="h-2" />
    </div>
  );
}
