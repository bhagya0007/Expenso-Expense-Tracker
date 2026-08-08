import React, { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Send,
  Bot,
  BrainCircuit,
  ShieldCheck,
  Plus,
  Mic,
  Lock,
  ArrowRight,
  TrendingUp,
  Wallet,
  Target,
  Zap,
  RotateCcw,
  Maximize2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { ChatMessage as ChatMessageType, ActionProposal } from "../types/ai.types";
import { processUserQuery } from "../engine/ai-orchestrator";
import { executeActionProposal } from "../tools/action-tools";
import { generateProactiveInsights } from "../engine/insights-generator";
import { ChatMessage } from "./chat-message";
import { AIInsightCard } from "./AIInsightCard";
import { ActionConfirmModal } from "./action-confirm-modal";
import { useAuth } from "@/hooks/use-auth";

export interface ExpensoAIChatProps {
  isMini?: boolean;
  onClose?: () => void;
  onExpand?: () => void;
}

export const ExpensoAIChat: React.FC<ExpensoAIChatProps> = ({ isMini = false, onClose, onExpand }) => {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => api.listTransactions(),
  });
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => api.listAccounts(),
  });
  const { data: budgets = [] } = useQuery({
    queryKey: ["budgets"],
    queryFn: () => api.listBudgets(),
  });

  const userName = profile?.full_name || "there";
  const storageKey = `expenso_ai_chat_history_${profile?.uid || "guest"}`;

  const defaultWelcomeMessage: ChatMessageType = React.useMemo(
    () => ({
      id: "welcome-1",
      sender: "assistant",
      text: `👋 Hi ${userName}! I'm **Expenso AI**, your financial intelligence assistant.\n\nAsk me anything about your spending, budgets, savings, or financial goals. I'll analyze your real data and give you deterministic, accurate insights!`,
      timestamp: new Date(),
    }),
    [userName]
  );

  const [messages, setMessages] = useState<ChatMessageType[]>(() => {
    try {
      const saved = localStorage.getItem(`expenso_ai_chat_history_${profile?.uid || "guest"}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((m: any) => ({
            ...m,
            timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
          }));
        }
      }
    } catch (e) {
      console.error("Failed to load saved chat history:", e);
    }
    return [
      {
        id: "welcome-1",
        sender: "assistant",
        text: `👋 Hi ${userName}! I'm **Expenso AI**, your financial intelligence assistant.\n\nAsk me anything about your spending, budgets, savings, or financial goals. I'll analyze your real data and give you deterministic, accurate insights!`,
        timestamp: new Date(),
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch (e) {
      console.error("Failed to persist chat history:", e);
    }
  }, [messages, storageKey]);

  const handleClearHistory = () => {
    setMessages([defaultWelcomeMessage]);
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {}
    toast.info("Chat session cleared");
  };

  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeModalProposal, setActiveModalProposal] = useState<ActionProposal | null>(null);
  const [isExecutingAction, setIsExecutingAction] = useState(false);
  const [dismissedInsightIds, setDismissedInsightIds] = useState<string[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  // Proactive Automated Insights
  const proactiveInsights = React.useMemo(() => {
    const raw = generateProactiveInsights(transactions, budgets);
    return raw.filter((ins) => !dismissedInsightIds.includes(ins.id));
  }, [transactions, budgets, dismissedInsightIds]);

  const handleDismissInsight = (id: string) => {
    setDismissedInsightIds((prev) => [...prev, id]);
    toast.info("Insight dismissed");
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isProcessing) return;

    const userMsg: ChatMessageType = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setIsProcessing(true);

    try {
      const assistantMsg = await processUserQuery(query, { name: userName });
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error("Expenso AI error:", err);
      const errorMsg: ChatMessageType = {
        id: `err-${Date.now()}`,
        sender: "assistant",
        text: "⚠️ **Evaluation Error**: Unable to complete calculation on your ledger. Please try rephrasing your question.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      toast.error("Failed to evaluate financial query.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmActionCard = (proposal: ActionProposal) => {
    setActiveModalProposal(proposal);
  };

  const handleCancelActionCard = (proposal: ActionProposal) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.actionProposal?.id === proposal.id
          ? { ...m, actionProposal: { ...proposal, status: "cancelled" } }
          : m
      )
    );
    toast.info("Action proposal cancelled");
  };

  const handleExecuteModalAction = async (proposal: ActionProposal) => {
    setIsExecutingAction(true);
    try {
      const confirmedProposal: ActionProposal = { ...proposal, status: "confirmed" };
      const result = await executeActionProposal(confirmedProposal);

      if (result.success) {
        await queryClient.refetchQueries({ queryKey: ["budgets"], type: "all" });
        await queryClient.refetchQueries({ queryKey: ["transactions"], type: "all" });
        await queryClient.refetchQueries({ queryKey: ["reminders"], type: "all" });
        await queryClient.refetchQueries({ queryKey: ["accounts"], type: "all" });

        setMessages((prev) =>
          prev.map((m) =>
            m.actionProposal?.id === proposal.id
              ? { ...m, actionProposal: confirmedProposal }
              : m
          )
        );

        toast.success(result.message);

        const successMsg: ChatMessageType = {
          id: `sys-${Date.now()}`,
          sender: "assistant",
          text: `✅ **Action Confirmed & Executed**\n\n${result.message}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, successMsg]);
      } else {
        toast.error(result.message);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to execute action.");
    } finally {
      setIsExecutingAction(false);
      setActiveModalProposal(null);
    }
  };

  const sampleQuickPrompts = [
    "How much did I spend last month?",
    "Show my top spending categories",
    "Am I on track with my budget?",
    "Suggest ways to save more",
  ];

  if (isMini) {
    return (
      <Card className="flex flex-col h-full w-full border border-indigo-500/30 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-2xl shadow-2xl rounded-3xl overflow-hidden">
        {/* Mini Chat Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border/50 bg-slate-900/80 dark:bg-slate-950/90 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative">
              <img
                src="/ai-insights-logo.png"
                alt="AI Insights"
                className="h-7 w-7 rounded-full object-cover shadow-sm bg-white"
              />
              <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-xs text-foreground truncate">Expenso AI Agent</h3>
              <p className="text-[10px] text-muted-foreground truncate">Financial Assistant</p>
            </div>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            {messages.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearHistory}
                title="Clear Session"
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
            {onExpand && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onExpand}
                title="Open Full Page Chat"
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            )}
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                title="Close Mini Chat"
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Mini Scrollable Message Feed */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <ChatMessage
                key={m.id}
                message={m}
                onConfirmAction={handleConfirmActionCard}
                onCancelAction={handleCancelActionCard}
              />
            ))}
          </AnimatePresence>

          {isProcessing && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground p-2.5 bg-muted/20 rounded-xl border border-border/40 w-fit">
              <Bot className="h-3.5 w-3.5 animate-spin text-indigo-400" />
              <span>Analyzing ledger metrics...</span>
            </div>
          )}

          <div ref={scrollRef} />
        </div>

        {/* Mini Quick Prompts Bar */}
        <div className="px-2.5 py-1.5 overflow-x-auto flex items-center gap-1.5 scrollbar-none shrink-0 border-t border-border/30 bg-muted/10">
          {sampleQuickPrompts.slice(0, 3).map((qp, i) => (
            <button
              key={i}
              type="button"
              disabled={isProcessing}
              onClick={() => handleSendMessage(qp)}
              className="px-2.5 py-1 rounded-full border border-border/60 bg-background/60 hover:bg-indigo-500/10 hover:border-indigo-500/40 text-[10px] font-medium text-foreground whitespace-nowrap shrink-0 transition-all"
            >
              {qp}
            </button>
          ))}
        </div>

        {/* Mini Input Box */}
        <div className="p-2.5 border-t border-border/60 bg-background/90 backdrop-blur-md shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-1.5 bg-card border border-border/80 rounded-xl px-2 py-1 shadow-inner focus-within:border-indigo-500/60 transition-all"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Expenso AI..."
              disabled={isProcessing}
              className="h-8 border-0 bg-transparent text-xs placeholder:text-muted-foreground/70 focus-visible:ring-0 focus-visible:ring-offset-0 px-1"
            />
            <Button
              type="submit"
              disabled={!input.trim() || isProcessing}
              className="h-7 w-7 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow shrink-0 p-0 grid place-items-center"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </form>
        </div>

        {/* Safety Modal */}
        <ActionConfirmModal
          proposal={activeModalProposal}
          isOpen={Boolean(activeModalProposal)}
          onClose={() => setActiveModalProposal(null)}
          onConfirmExecute={handleExecuteModalAction}
          isLoading={isExecutingAction}
        />
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-7xl h-full flex flex-col space-y-3 overflow-hidden w-full">
      {/* Top Header Row (Matching Prototype Screenshot 4) */}
      <div className="flex items-center justify-between gap-4 px-1 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-400" />
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              AI Insights
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your AI financial companion. Ask anything about your money.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 gap-1.5 py-1 px-3 rounded-full text-xs font-medium backdrop-blur-md">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> 100% Deterministic & Anti-Hallucination
          </Badge>
        </div>
      </div>

      {/* Main 2-Column Split Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch min-h-0 overflow-hidden">
        {/* Left Column: Chat Console (8 Cols) */}
        <div className="lg:col-span-8 h-full flex flex-col min-h-0 overflow-hidden">
          <Card className="flex-1 flex flex-col overflow-hidden min-h-0 border border-border/60 bg-card/60 backdrop-blur-xl shadow-2xl rounded-3xl">
            {/* Console Header Bar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 bg-muted/20 text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-medium text-foreground">Live Financial Session</span>
              </div>
              {messages.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearHistory}
                  className="h-7 text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1.5 px-2.5 rounded-lg transition-colors"
                >
                  <RotateCcw className="h-3 w-3" /> Clear Session
                </Button>
              )}
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
              <AnimatePresence initial={false}>
                {messages.map((m) => (
                  <ChatMessage
                    key={m.id}
                    message={m}
                    onConfirmAction={handleConfirmActionCard}
                    onCancelAction={handleCancelActionCard}
                  />
                ))}
              </AnimatePresence>

              {isProcessing && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground p-3 bg-muted/20 rounded-2xl border border-border/40 w-fit">
                  <div className="grid h-6 w-6 place-items-center rounded-lg bg-indigo-500/20 text-indigo-400">
                    <Bot className="h-3.5 w-3.5 animate-spin" />
                  </div>
                  <span>Calculating factual ledger metrics...</span>
                </div>
              )}

              <div ref={scrollRef} />
            </div>

            {/* Bottom Input Area (Prototype Screenshot 4 Style) */}
            <div className="border-t border-border/60 bg-background/80 p-3 sm:p-4 backdrop-blur-xl space-y-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2 bg-card/80 border border-border/80 rounded-2xl px-3 py-1.5 shadow-inner focus-within:border-indigo-500/60 transition-all"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground shrink-0"
                  onClick={() => toast.info("Attach feature available soon")}
                >
                  <Plus className="h-4 w-4" />
                </Button>

                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything about your finances..."
                  disabled={isProcessing}
                  className="h-10 border-0 bg-transparent text-sm placeholder:text-muted-foreground/70 focus-visible:ring-0 focus-visible:ring-offset-0 px-2"
                />

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground shrink-0"
                  onClick={() => toast.info("Voice input available soon")}
                >
                  <Mic className="h-4 w-4" />
                </Button>

                <Button
                  type="submit"
                  disabled={!input.trim() || isProcessing}
                  className="h-9 w-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md shrink-0 p-0 grid place-items-center transition-all"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/80 pt-1">
                <Lock className="h-3 w-3 text-emerald-400" />
                <span>All calculations are performed deterministically on your actual ledger data.</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Sidebar Insights & Quick Prompts (4 Cols) */}
        <div className="lg:col-span-4 h-full flex flex-col space-y-4 min-h-0 overflow-y-auto pr-1">
          {/* AI Insights Card */}
          <Card className="p-5 border border-border/60 bg-card/60 backdrop-blur-xl shadow-xl rounded-3xl space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-foreground">AI Insights</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Get personalized insights based on your data.
            </p>

            <div className="space-y-3">
              {proactiveInsights.length > 0 ? (
                proactiveInsights.map((ins) => (
                  <AIInsightCard
                    key={ins.id}
                    id={ins.id}
                    type={
                      ins.severity === "danger"
                        ? "warning"
                        : ins.severity === "warning"
                        ? "anomaly"
                        : ins.severity === "success"
                        ? "opportunity"
                        : "tip"
                    }
                    title={ins.title}
                    description={ins.description}
                    metric={ins.impactAmount ? `₹${ins.impactAmount.toLocaleString("en-IN")}` : undefined}
                    onDismiss={handleDismissInsight}
                  />
                ))
              ) : (
                <div className="p-4 rounded-2xl border border-border/40 bg-muted/20 text-xs text-muted-foreground space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-medium">
                    <TrendingUp className="h-4 w-4" />
                    <span>Spending Balanced</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Your spending across categories is well within historical averages this month.
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Quick Prompts Card */}
          <Card className="p-5 border border-border/60 bg-card/60 backdrop-blur-xl shadow-xl rounded-3xl space-y-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-foreground">Quick Prompts</h3>
            </div>
            <p className="text-xs text-muted-foreground">Try asking these</p>

            <div className="space-y-2">
              {sampleQuickPrompts.map((qp, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleSendMessage(qp)}
                  className="w-full text-left p-3 rounded-2xl border border-border/50 bg-background/50 hover:bg-indigo-500/10 hover:border-indigo-500/40 text-xs text-foreground transition-all duration-200"
                >
                  {qp}
                </button>
              ))}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSendMessage("Show all sample prompt examples")}
              className="w-full text-xs text-muted-foreground hover:text-foreground justify-between pt-2"
            >
              <span>View all examples</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Card>
        </div>
      </div>

      {/* Safety Confirmation Modal */}
      <ActionConfirmModal
        proposal={activeModalProposal}
        isOpen={Boolean(activeModalProposal)}
        onClose={() => setActiveModalProposal(null)}
        onConfirmExecute={handleExecuteModalAction}
        isLoading={isExecutingAction}
      />
    </div>
  );
};
