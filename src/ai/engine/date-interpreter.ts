export interface DateRangeResult {
  startDate: Date;
  endDate: Date;
  startDateISO: string;
  endDateISO: string;
  label: string;
  isComparison?: boolean;
  comparisonRange?: DateRangeResult;
}

const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const MONTH_SHORT = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function toLocalISOString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getMonthIndex(token: string): number | -1 {
  const t = token.toLowerCase().trim();
  const nameIdx = MONTH_NAMES.indexOf(t);
  if (nameIdx !== -1) return nameIdx;
  const shortIdx = MONTH_SHORT.indexOf(t);
  if (shortIdx !== -1) return shortIdx;
  return -1;
}

/**
 * Converts natural-language time expressions into deterministic DateRangeResult objects.
 */
export function interpretDateExpression(
  prompt: string,
  referenceDate: Date = new Date()
): DateRangeResult {
  const p = prompt.toLowerCase().trim();
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();

  // Helper to create single day range
  const createDayRange = (targetDate: Date, label: string): DateRangeResult => {
    const start = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);
    const end = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);
    return {
      startDate: start,
      endDate: end,
      startDateISO: toLocalISOString(start),
      endDateISO: toLocalISOString(end),
      label,
    };
  };

  // Helper to create month range
  const createMonthRange = (year: number, monthIndex: number, label: string): DateRangeResult => {
    const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
    const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
    return {
      startDate: start,
      endDate: end,
      startDateISO: toLocalISOString(start),
      endDateISO: toLocalISOString(end),
      label,
    };
  };

  // 1. Check for Month Comparison (e.g. "Compare June and July", "Compare July to August")
  if (p.includes("compare")) {
    const words = p.replace(/[^a-z0-9\s]/g, " ").split(/\s+/);
    const matchedMonthIndices: number[] = [];

    for (const w of words) {
      const idx = getMonthIndex(w);
      if (idx !== -1 && !matchedMonthIndices.includes(idx)) {
        matchedMonthIndices.push(idx);
      }
    }

    if (matchedMonthIndices.length >= 2) {
      const idx1 = matchedMonthIndices[0];
      const idx2 = matchedMonthIndices[1];

      // Assume the second month is the primary target and first is comparison
      const y1 = idx1 > refMonth ? refYear - 1 : refYear;
      const y2 = idx2 > refMonth ? refYear - 1 : refYear;

      const rPrimary = createMonthRange(y2, idx2, MONTH_NAMES[idx2].toUpperCase());
      const rComp = createMonthRange(y1, idx1, MONTH_NAMES[idx1].toUpperCase());

      return {
        ...rPrimary,
        label: `Comparison: ${rPrimary.label} vs ${rComp.label}`,
        isComparison: true,
        comparisonRange: rComp,
      };
    }

    if (p.includes("last month") && p.includes("this month")) {
      const rPrimary = createMonthRange(refYear, refMonth, "This Month");
      const prevM = refMonth === 0 ? 11 : refMonth - 1;
      const prevY = refMonth === 0 ? refYear - 1 : refYear;
      const rComp = createMonthRange(prevY, prevM, "Last Month");

      return {
        ...rPrimary,
        label: "Comparison: This Month vs Last Month",
        isComparison: true,
        comparisonRange: rComp,
      };
    }
  }

  // 2. Check for "Since [Month]" (e.g. "since July", "since June")
  if (p.includes("since")) {
    const words = p.replace(/[^a-z0-9\s]/g, " ").split(/\s+/);
    const sinceIdx = words.indexOf("since");

    if (sinceIdx !== -1 && words[sinceIdx + 1]) {
      const targetMonthIdx = getMonthIndex(words[sinceIdx + 1]);
      if (targetMonthIdx !== -1) {
        const y = targetMonthIdx > refMonth ? refYear - 1 : refYear;
        const start = new Date(y, targetMonthIdx, 1, 0, 0, 0, 0);
        const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate(), 23, 59, 59, 999);

        return {
          startDate: start,
          endDate: end,
          startDateISO: toLocalISOString(start),
          endDateISO: toLocalISOString(end),
          label: `Since ${MONTH_NAMES[targetMonthIdx]} ${y}`,
        };
      }
    }
  }

  // 3. "Today"
  if (p.includes("today")) {
    return createDayRange(referenceDate, "Today");
  }

  // 4. "Yesterday"
  if (p.includes("yesterday")) {
    const yest = new Date(referenceDate);
    yest.setDate(yest.getDate() - 1);
    return createDayRange(yest, "Yesterday");
  }

  // 5. "This Week"
  if (p.includes("this week")) {
    const day = referenceDate.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1; // Monday start
    const monday = new Date(referenceDate);
    monday.setDate(monday.getDate() - diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return {
      startDate: monday,
      endDate: sunday,
      startDateISO: toLocalISOString(monday),
      endDateISO: toLocalISOString(sunday),
      label: "This Week",
    };
  }

  // 6. "Last Week"
  if (p.includes("last week")) {
    const day = referenceDate.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const thisMonday = new Date(referenceDate);
    thisMonday.setDate(thisMonday.getDate() - diffToMonday);

    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(lastMonday.getDate() - 7);
    lastMonday.setHours(0, 0, 0, 0);

    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastSunday.getDate() + 6);
    lastSunday.setHours(23, 59, 59, 999);

    return {
      startDate: lastMonday,
      endDate: lastSunday,
      startDateISO: toLocalISOString(lastMonday),
      endDateISO: toLocalISOString(lastSunday),
      label: "Last Week",
    };
  }

  // 7. "Last Month"
  if (p.includes("last month")) {
    const prevM = refMonth === 0 ? 11 : refMonth - 1;
    const prevY = refMonth === 0 ? refYear - 1 : refYear;
    return createMonthRange(prevY, prevM, "Last Month");
  }

  // 8. "This Month"
  if (p.includes("this month")) {
    return createMonthRange(refYear, refMonth, "This Month");
  }

  // 9. "Last 3 Months" / "Past 3 Months" / "90 Days"
  if (p.includes("3 month") || p.includes("three month") || p.includes("90 day")) {
    const start = new Date(refYear, refMonth - 2, 1, 0, 0, 0, 0);
    const end = new Date(refYear, refMonth + 1, 0, 23, 59, 59, 999);
    return {
      startDate: start,
      endDate: end,
      startDateISO: toLocalISOString(start),
      endDateISO: toLocalISOString(end),
      label: "Last 3 Months",
    };
  }

  // 10. Check for explicit single month name (e.g. "in July", "in June")
  const words = p.replace(/[^a-z0-9\s]/g, " ").split(/\s+/);
  for (const w of words) {
    const monthIdx = getMonthIndex(w);
    if (monthIdx !== -1) {
      const y = monthIdx > refMonth ? refYear - 1 : refYear;
      return createMonthRange(y, monthIdx, `${MONTH_NAMES[monthIdx]} ${y}`);
    }
  }

  // Default Fallback: Current Month
  return createMonthRange(refYear, refMonth, "This Month");
}
