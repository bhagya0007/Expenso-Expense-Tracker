import { useEffect, useRef, useState, useCallback, memo } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  placeholder?: string;
  className?: string;
  allowNegative?: boolean;
  id?: string;
};

const groupINR = (digits: string) => {
  if (!digits) return "";
  const n = digits.replace(/\D/g, "");
  if (!n) return "";
  // Indian grouping: last 3, then groups of 2
  const last3 = n.slice(-3);
  const rest = n.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3 : last3;
  return grouped;
};

const formatFromNumber = (v: number) => {
  if (!v || Number.isNaN(v)) return "";
  const parts = String(v).split(".");
  const abs = Math.abs(Math.trunc(Number(parts[0])));
  const grouped = groupINR(String(abs));
  const dec = parts[1] !== undefined ? "." + parts[1] : "";
  return (v < 0 ? "-" : "") + grouped + dec;
};

const parseFormattedString = (raw: string, allowNegative: boolean): { n: number; formatted: string } => {
  const trimmed = raw.trim();
  const negative = allowNegative && trimmed.startsWith("-");
  const clean = trimmed.replace(negative ? /^-/ : "", "");

  const parts = clean.split(".");
  const intDigits = parts[0].replace(/\D/g, "");
  const hasDecimal = parts.length > 1;
  const decDigits = hasDecimal ? parts.slice(1).join("").replace(/\D/g, "").slice(0, 2) : "";

  const formattedInt = groupINR(intDigits);
  const formattedDec = hasDecimal ? "." + decDigits : "";
  const formatted = (negative && (intDigits || hasDecimal) ? "-" : "") + formattedInt + formattedDec;

  const numStr = (negative ? "-" : "") + (intDigits || "0") + (hasDecimal ? "." + decDigits : "");
  const n = Number(numStr) || 0;

  return { n, formatted };
};

function CurrencyInputBase({
  value, onChange, step = 100, min, max, placeholder = "0",
  className, allowNegative = false, id,
}: Props) {
  const [text, setText] = useState<string>(() => formatFromNumber(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(formatFromNumber(value));
  }, [value]);

  const clamp = useCallback((n: number) => {
    if (typeof min === "number" && n < min) return min;
    if (typeof max === "number" && n > max) return max;
    return n;
  }, [min, max]);

  const commit = useCallback((raw: string) => {
    const { n } = parseFormattedString(raw, allowNegative);
    const clamped = clamp(n);
    onChange(clamped);
    return clamped;
  }, [allowNegative, clamp, onChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const { n, formatted } = parseFormattedString(raw, allowNegative);
    setText(formatted);
    onChange(clamp(n));
  };

  const bump = (delta: number) => {
    const current = value || 0;
    const next = clamp(Number((current + delta).toFixed(2)));
    onChange(next);
    setText(formatFromNumber(next));
  };

  return (
    <div className={cn(
      "flex items-stretch h-10 rounded-md border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0 transition-shadow",
      className
    )}>
      <button
        type="button"
        onClick={() => bump(-step)}
        className="px-2.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-label="Decrease"
        tabIndex={-1}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <div className="flex items-center pl-2 text-muted-foreground select-none font-numeric text-sm">₹</div>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={text}
        placeholder={placeholder}
        onFocus={() => { focused.current = true; }}
        onBlur={(e) => { focused.current = false; const n = commit(e.target.value); setText(formatFromNumber(n)); }}
        onChange={handleChange}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") { e.preventDefault(); bump(step); }
          else if (e.key === "ArrowDown") { e.preventDefault(); bump(-step); }
        }}
        className="flex-1 min-w-0 bg-transparent px-2 py-2 text-sm font-numeric tabular-nums outline-none placeholder:text-muted-foreground"
      />
      <button
        type="button"
        onClick={() => bump(step)}
        className="px-2.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-label="Increase"
        tabIndex={-1}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export const CurrencyInput = memo(CurrencyInputBase);
