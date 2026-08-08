import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, CheckCircle2, XCircle } from "lucide-react";
import type { ActionProposal } from "../types/ai.types";

interface ActionProposalCardProps {
  proposal: ActionProposal;
  onConfirm: (proposal: ActionProposal) => void;
  onCancel: (proposal: ActionProposal) => void;
}

export const ActionProposalCard: React.FC<ActionProposalCardProps> = ({
  proposal,
  onConfirm,
  onCancel,
}) => {
  return (
    <div className="mt-3 rounded-2xl border border-primary/30 bg-primary/10 p-4 backdrop-blur-md transition-all">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/20 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h4 className="font-display text-sm font-semibold">{proposal.title}</h4>
            <p className="text-xs text-muted-foreground">{proposal.description}</p>
          </div>
        </div>
        <Badge variant="outline" className="border-primary/40 text-xs text-primary">
          Action Proposal
        </Badge>
      </div>

      {proposal.status === "pending" ? (
        <div className="mt-3 flex items-center gap-2 justify-end">
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-xl text-xs border-border/80"
            onClick={() => onCancel(proposal)}
          >
            <XCircle className="mr-1.5 h-3.5 w-3.5" /> Reject
          </Button>
          <Button
            size="sm"
            className="h-8 rounded-xl text-xs gradient-primary font-medium"
            onClick={() => onConfirm(proposal)}
          >
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Review & Confirm
          </Button>
        </div>
      ) : proposal.status === "confirmed" ? (
        <div className="mt-2.5 flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
          <CheckCircle2 className="h-4 w-4" /> Confirmed & Applied to Ledger
        </div>
      ) : (
        <div className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <XCircle className="h-4 w-4" /> Rejected
        </div>
      )}
    </div>
  );
};
