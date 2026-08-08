import { createFileRoute } from "@tanstack/react-router";
import { ExpensoAIChat } from "@/ai/components/expenso-ai-chat";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Expenso AI — Intelligent Financial Assistant | Expenso" },
      { name: "description", content: "Ask questions about your transactions, spending habits, and budgets with Expenso AI." },
    ],
  }),
  component: () => (
    <div className="h-[calc(100vh-4.2rem)] p-3 sm:p-4 overflow-hidden flex flex-col">
      <ExpensoAIChat />
    </div>
  ),
});
