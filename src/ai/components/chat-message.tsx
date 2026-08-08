import React from "react";
import { motion } from "framer-motion";
import { Bot, User, Sparkles, Calculator } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ChatMessage as ChatMessageType, ActionProposal } from "../types/ai.types";
import { ActionProposalCard } from "./action-proposal-card";
import { FormattedMarkdown } from "./formatted-markdown";

interface ChatMessageProps {
  message: ChatMessageType;
  onConfirmAction?: (proposal: ActionProposal) => void;
  onCancelAction?: (proposal: ActionProposal) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  onConfirmAction,
  onCancelAction,
}) => {
  const isUser = message.sender === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      <div
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-semibold ${
          isUser
            ? "bg-indigo-600 text-white shadow-md"
            : "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div className={`max-w-[85%] sm:max-w-[80%] space-y-2 ${isUser ? "items-end text-right" : "items-start text-left"}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? "bg-indigo-600 text-white rounded-tr-none shadow-md font-medium"
              : "border border-border/60 bg-card/80 rounded-tl-none text-foreground shadow-card backdrop-blur-md"
          }`}
        >
          {/* Formatted Markdown Content */}
          <FormattedMarkdown content={message.text} isUser={isUser} />

          {/* Factual Calculation Metadata Badge */}
          {message.calculationResult && !isUser && (
            <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center gap-2 text-[11px] text-muted-foreground">
              <Calculator className="h-3.5 w-3.5 text-primary" />
              <span>
                Verified Math Engine: <strong className="text-foreground">{message.calculationResult.toolName}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Action Proposal Card */}
        {message.actionProposal && onConfirmAction && onCancelAction && (
          <ActionProposalCard
            proposal={message.actionProposal}
            onConfirm={onConfirmAction}
            onCancel={onCancelAction}
          />
        )}

        <div className="text-[10px] text-muted-foreground px-1">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </motion.div>
  );
};
