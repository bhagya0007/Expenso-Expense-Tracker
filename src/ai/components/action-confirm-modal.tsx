import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ArrowRight, AlertTriangle } from "lucide-react";
import type { ActionProposal } from "../types/ai.types";

interface ActionConfirmModalProps {
  proposal: ActionProposal | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmExecute: (proposal: ActionProposal) => Promise<void>;
  isLoading?: boolean;
}

export const ActionConfirmModal: React.FC<ActionConfirmModalProps> = ({
  proposal,
  isOpen,
  onClose,
  onConfirmExecute,
  isLoading,
}) => {
  if (!proposal) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md rounded-2xl border-border/80 bg-background/95 backdrop-blur-xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Confirm Ledger Action</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Expenso AI safety verification before modifying your financial records.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-3">
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Action Type:</span>
              <Badge variant="outline" className="text-[11px] font-medium border-primary/30 text-primary">
                {proposal.type}
              </Badge>
            </div>
            {proposal.payload.category && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Category:</span>
                <span className="font-semibold text-foreground">{proposal.payload.category}</span>
              </div>
            )}
            {proposal.payload.amount !== undefined && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-semibold text-emerald-400">
                  ₹{proposal.payload.amount.toLocaleString("en-IN")}
                </span>
              </div>
            )}
            {proposal.payload.limit !== undefined && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Budget Limit:</span>
                <span className="font-semibold text-primary">
                  ₹{proposal.payload.limit.toLocaleString("en-IN")} ({proposal.payload.period || "monthly"})
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>This will immediately update your active ledger store and sync with Firestore.</span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isLoading} className="rounded-xl text-xs">
            Cancel
          </Button>
          <Button
            onClick={() => onConfirmExecute(proposal)}
            disabled={isLoading}
            className="rounded-xl text-xs gradient-primary font-semibold shadow-glow"
          >
            {isLoading ? "Executing..." : "Confirm & Execute"} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
