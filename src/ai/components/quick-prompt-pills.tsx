import React from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, TrendingUp, PieChart, Wallet, ShieldAlert } from "lucide-react";

interface QuickPromptPillsProps {
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
}

export const QuickPromptPills: React.FC<QuickPromptPillsProps> = ({
  onSelectPrompt,
  disabled,
}) => {
  const prompts = [
    {
      label: "Food Expenses",
      prompt: "How much did I spend on Food this month?",
      icon: <PieChart className="h-3.5 w-3.5 text-primary" />,
    },
    {
      label: "Monthly Summary",
      prompt: "Summarize my spending and income for this month",
      icon: <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />,
    },
    {
      label: "Check Budgets",
      prompt: "Show my budget status and limit warnings",
      icon: <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />,
    },
    {
      label: "Add Food Budget",
      prompt: "Set a 5000 Food & Dining budget",
      icon: <Wallet className="h-3.5 w-3.5 text-purple-400" />,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      {prompts.map((p, idx) => (
        <Button
          key={idx}
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => onSelectPrompt(p.prompt)}
          className="h-8 rounded-full border-border/60 bg-background/50 hover:bg-primary/10 hover:border-primary/40 text-xs text-muted-foreground hover:text-foreground backdrop-blur transition-all flex items-center gap-1.5"
        >
          {p.icon}
          <span>{p.label}</span>
        </Button>
      ))}
    </div>
  );
};
