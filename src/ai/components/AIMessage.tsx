import React from "react";
import { motion } from "framer-motion";
import { Bot, User } from "lucide-react";
import { FormattedMarkdown } from "./formatted-markdown";

export interface MessageProps {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: Date;
  isError?: boolean;
}

export const AIMessage: React.FC<{ message: MessageProps }> = ({ message }) => {
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
            ? "gradient-primary text-primary-foreground shadow-glow"
            : message.isError
            ? "bg-red-500/20 border border-red-500/40 text-red-400"
            : "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div
        className={`max-w-[85%] sm:max-w-[80%] space-y-1.5 ${
          isUser ? "items-end text-right" : "items-start text-left"
        }`}
      >
        <div
          className={`rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-none shadow-glow font-medium"
              : message.isError
              ? "border border-red-500/40 bg-red-500/10 text-red-200 rounded-tl-none"
              : "border border-border/60 bg-card/80 rounded-tl-none text-foreground shadow-card backdrop-blur-md"
          }`}
        >
          <FormattedMarkdown content={message.text} isUser={isUser} />
        </div>

        <div className="text-[10px] text-muted-foreground/70 px-1">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </motion.div>
  );
};
