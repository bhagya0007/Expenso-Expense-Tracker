import React from "react";
import { Button } from "@/components/ui/button";
import { DollarSign, PieChart, TrendingUp, Wallet, ShoppingBag, ArrowLeftRight, PiggyBank, Flame, Layers } from "lucide-react";

interface SuggestedQuestionsProps {
  onSelectQuestion: (question: string) => void;
  disabled?: boolean;
}

export const SUGGESTED_QUESTIONS = [
  {
    text: "How much did I spend this month?",
    icon: <DollarSign className="h-3.5 w-3.5 text-emerald-400" />,
  },
  {
    text: "Where did most of my money go?",
    icon: <PieChart className="h-3.5 w-3.5 text-primary" />,
  },
  {
    text: "How much did I spend on food?",
    icon: <Wallet className="h-3.5 w-3.5 text-cyan-400" />,
  },
  {
    text: "How much did I spend on Amazon?",
    icon: <ShoppingBag className="h-3.5 w-3.5 text-amber-400" />,
  },
  {
    text: "Compare this month with last month.",
    icon: <ArrowLeftRight className="h-3.5 w-3.5 text-purple-400" />,
  },
  {
    text: "Why did I spend more this month?",
    icon: <TrendingUp className="h-3.5 w-3.5 text-red-400" />,
  },
  {
    text: "How much did I save?",
    icon: <PiggyBank className="h-3.5 w-3.5 text-emerald-400" />,
  },
  {
    text: "What was my biggest expense?",
    icon: <Flame className="h-3.5 w-3.5 text-orange-400" />,
  },
  {
    text: "What are my top spending categories?",
    icon: <Layers className="h-3.5 w-3.5 text-blue-400" />,
  },
];

export const SuggestedQuestions: React.FC<SuggestedQuestionsProps> = ({
  onSelectQuestion,
  disabled,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {SUGGESTED_QUESTIONS.map((q, idx) => (
        <Button
          key={idx}
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => onSelectQuestion(q.text)}
          className="h-8 rounded-full border-border/60 bg-background/50 hover:bg-primary/10 hover:border-primary/40 text-xs text-muted-foreground hover:text-foreground backdrop-blur transition-all flex items-center gap-1.5 shadow-sm"
        >
          {q.icon}
          <span>{q.text}</span>
        </Button>
      ))}
    </div>
  );
};
