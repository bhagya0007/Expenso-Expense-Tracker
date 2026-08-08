import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, TrendingUp, ShieldAlert, Sparkles, X } from "lucide-react";

export interface InsightCardProps {
  id: string;
  type: "anomaly" | "warning" | "opportunity" | "tip";
  title: string;
  description: string;
  metric?: string;
  onActionClick?: () => void;
  onDismiss?: (id: string) => void;
}

export const AIInsightCard: React.FC<InsightCardProps> = ({
  id,
  type,
  title,
  description,
  metric,
  onActionClick,
  onDismiss,
}) => {
  const getSeverityStyles = () => {
    switch (type) {
      case "warning":
        return {
          border: "border-amber-500/30",
          bg: "bg-amber-500/10",
          text: "text-amber-300",
          badge: "border-amber-500/40 text-amber-400 bg-amber-500/10",
          icon: <ShieldAlert className="h-4 w-4 text-amber-400" />,
        };
      case "anomaly":
        return {
          border: "border-red-500/30",
          bg: "bg-red-500/10",
          text: "text-red-300",
          badge: "border-red-500/40 text-red-400 bg-red-500/10",
          icon: <Zap className="h-4 w-4 text-red-400" />,
        };
      case "opportunity":
        return {
          border: "border-emerald-500/30",
          bg: "bg-emerald-500/10",
          text: "text-emerald-300",
          badge: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
          icon: <TrendingUp className="h-4 w-4 text-emerald-400" />,
        };
      case "tip":
      default:
        return {
          border: "border-primary/30",
          bg: "bg-primary/10",
          text: "text-primary-foreground",
          badge: "border-primary/40 text-primary bg-primary/10",
          icon: <Sparkles className="h-4 w-4 text-primary" />,
        };
    }
  };

  const style = getSeverityStyles();

  return (
    <Card
      className={`relative p-3.5 border ${style.border} ${style.bg} transition-all duration-300 hover:scale-[1.01]`}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          onClick={onActionClick}
          className={`flex items-start gap-2.5 flex-1 ${onActionClick ? "cursor-pointer" : ""}`}
        >
          <div className="p-1.5 rounded-lg bg-background/50 backdrop-blur shrink-0 mt-0.5">
            {style.icon}
          </div>
          <div>
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
              {title}
            </h4>
            <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{description}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {metric && (
            <Badge variant="outline" className={`text-[10px] font-mono ${style.badge}`}>
              {metric}
            </Badge>
          )}

          {onDismiss && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(id);
              }}
              className="h-6 w-6 rounded-md hover:bg-background/40 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};
