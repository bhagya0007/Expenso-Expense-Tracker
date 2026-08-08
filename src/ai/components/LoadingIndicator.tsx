import React from "react";
import { Bot, Sparkles } from "lucide-react";

export const LoadingIndicator: React.FC = () => {
  return (
    <div className="flex items-start gap-3 text-xs text-muted-foreground animate-pulse">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/15 border border-primary/30 text-primary">
        <Bot className="h-4 w-4 animate-spin" />
      </div>
      <div className="flex items-center gap-2 rounded-2xl border border-border/60 gradient-card px-4 py-3 text-foreground shadow-card backdrop-blur-md rounded-tl-none">
        <Sparkles className="h-3.5 w-3.5 text-primary animate-bounce" />
        <span className="text-xs font-medium text-muted-foreground">Expenso AI is thinking...</span>
        <div className="flex items-center gap-1 ml-1">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary/80 animate-ping delay-150" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-ping delay-300" />
        </div>
      </div>
    </div>
  );
};
