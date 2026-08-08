import React from "react";
import { motion } from "framer-motion";
import { Sparkles, BrainCircuit, ShieldCheck, Zap } from "lucide-react";
import { SuggestedQuestions } from "./SuggestedQuestions";

interface EmptyStateProps {
  onSelectQuestion: (question: string) => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onSelectQuestion }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[380px] p-6 text-center space-y-6 max-w-2xl mx-auto">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="relative"
      >
        <div className="grid h-16 w-16 place-items-center rounded-2xl gradient-primary shadow-glow">
          <Sparkles className="h-8 w-8 text-primary-foreground" />
        </div>
        <div className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-background" />
        </div>
      </motion.div>

      <div className="space-y-2">
        <h2 className="font-display text-2xl font-bold tracking-tight text-gradient">
          Expenso AI Financial Assistant
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
          Ask questions about your transactions, category spending, monthly velocity, or budget targets. All math is calculated deterministically on your ledger.
        </p>
      </div>

      <div className="w-full pt-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Suggested Questions to Start:
        </p>
        <SuggestedQuestions onSelectQuestion={onSelectQuestion} />
      </div>
    </div>
  );
};
