import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, CornerDownLeft } from "lucide-react";

interface AIInputProps {
  onSendMessage: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const AIInput: React.FC<AIInputProps> = ({
  onSendMessage,
  disabled,
  placeholder = "Ask Expenso AI about your finances...",
}) => {
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    onSendMessage(text.trim());
    setText("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 relative">
      <div className="relative flex-1">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="h-12 rounded-xl bg-background/80 border-border/80 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/60 pr-12 focus-visible:ring-primary shadow-inner"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground/60 bg-muted/40 px-1.5 py-0.5 rounded border border-border/40 pointer-events-none">
          <CornerDownLeft className="h-3 w-3" />
          <span>Enter</span>
        </div>
      </div>

      <Button
        type="submit"
        disabled={!text.trim() || disabled}
        className="h-12 w-12 rounded-xl gradient-primary font-semibold shadow-glow shrink-0 transition-transform active:scale-95 disabled:opacity-50"
      >
        <Send className="h-4 w-4 text-primary-foreground" />
      </Button>
    </form>
  );
};
