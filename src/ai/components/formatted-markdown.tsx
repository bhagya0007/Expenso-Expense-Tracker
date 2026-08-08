import React from "react";

interface FormattedMarkdownProps {
  content: string;
  className?: string;
  isUser?: boolean;
}

export const FormattedMarkdown: React.FC<FormattedMarkdownProps> = ({
  content,
  className = "",
  isUser = false,
}) => {
  if (!content) return null;

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  let inTable = false;
  let tableHeader: string[] = [];
  let tableRows: string[][] = [];

  const textClass = isUser
    ? "text-white"
    : "text-foreground dark:text-slate-100";

  const headingClass = isUser
    ? "text-white font-bold"
    : "text-emerald-600 dark:text-emerald-400 font-bold";

  const accentClass = isUser
    ? "text-white font-semibold underline underline-offset-2"
    : "text-emerald-700 dark:text-emerald-300 font-semibold";

  const bulletClass = isUser
    ? "bg-white"
    : "bg-emerald-600 dark:bg-emerald-400";

  const flushTable = (keyPrefix: string) => {
    if (inTable && tableHeader.length > 0) {
      elements.push(
        <div
          key={`table-${keyPrefix}`}
          className="my-3 overflow-x-auto rounded-xl border border-border/60 bg-background/50 backdrop-blur-md shadow-sm"
        >
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40 text-muted-foreground font-semibold">
                {tableHeader.map((h, i) => (
                  <th key={i} className="px-3 py-2">
                    {parseInlineMarkdown(h, accentClass)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {tableRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-muted/20 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 text-foreground">
                      {parseInlineMarkdown(cell, accentClass)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      inTable = false;
      tableHeader = [];
      tableRows = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Markdown table row detection
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cells = trimmed
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());

      if (cells.every((c) => /^:?-+:?$/.test(c))) {
        return; // Skip divider row
      }

      if (!inTable) {
        inTable = true;
        tableHeader = cells;
      } else {
        tableRows.push(cells);
      }
      return;
    } else if (inTable) {
      flushTable(`line-${idx}`);
    }

    if (!trimmed) {
      elements.push(<div key={`sp-${idx}`} className="h-1.5" />);
      return;
    }

    // Bullet point detection
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const itemText = trimmed.slice(2);
      elements.push(
        <div key={`li-${idx}`} className={`flex items-start gap-2 my-1 text-xs sm:text-sm ${textClass} pl-1`}>
          <span className={`mt-1.5 h-1.5 w-1.5 rounded-full ${bulletClass} shrink-0`} />
          <div className="flex-1">{parseInlineMarkdown(itemText, accentClass)}</div>
        </div>
      );
      return;
    }

    // Numbered list detection
    const numMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numMatch) {
      elements.push(
        <div key={`nli-${idx}`} className={`flex items-start gap-2 my-1 text-xs sm:text-sm ${textClass} pl-1`}>
          <span className={`font-mono text-xs font-semibold ${headingClass} shrink-0`}>{numMatch[1]}.</span>
          <div className="flex-1">{parseInlineMarkdown(numMatch[2], accentClass)}</div>
        </div>
      );
      return;
    }

    // Heading detection
    if (trimmed.startsWith("### ")) {
      elements.push(
        <h4 key={`h3-${idx}`} className={`text-xs sm:text-sm ${headingClass} mt-2 mb-1`}>
          {parseInlineMarkdown(trimmed.slice(4), accentClass)}
        </h4>
      );
      return;
    }

    // Standard paragraph line
    elements.push(
      <p key={`p-${idx}`} className={`text-xs sm:text-sm leading-relaxed my-0.5 ${textClass}`}>
        {parseInlineMarkdown(trimmed, accentClass)}
      </p>
    );
  });

  if (inTable) {
    flushTable("end");
  }

  return <div className={`space-y-1 ${className}`}>{elements}</div>;
};

/**
 * Parses inline markdown elements (**bold**, *italic*, `code`) into React elements.
 */
function parseInlineMarkdown(text: string, accentClass: string): React.ReactNode {
  if (!text) return null;

  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const boldContent = part.slice(2, -2);
      return (
        <strong key={i} className={accentClass}>
          {boldContent}
        </strong>
      );
    }

    const italicParts = part.split(/(\*[^*]+\*)/g);
    return italicParts.map((subPart, j) => {
      if (subPart.startsWith("*") && subPart.endsWith("*") && !subPart.startsWith("**")) {
        return (
          <em key={`${i}-${j}`} className="italic opacity-90">
            {subPart.slice(1, -1)}
          </em>
        );
      }
      return subPart;
    });
  });
}
