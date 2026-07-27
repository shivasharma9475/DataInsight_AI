// Lightweight, display-only heuristics for formatting metric values.
// The backend never tells us a currency/unit, so we infer a sensible
// presentation from the column name. This never affects any calculation -
// it only changes how a number already computed by the backend is displayed.

const CURRENCY_HINTS = /sales|revenue|price|cost|profit|income|spend|expense|amount|earnings|budget|fare|fee/i;

export function isLikelyCurrency(metricName = "") {
  return CURRENCY_HINTS.test(metricName);
}

export function formatMetricValue(value, metricName = "") {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  const maximumFractionDigits = abs !== 0 && abs < 10 ? 2 : 0;
  const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value);
  return isLikelyCurrency(metricName) ? `${value < 0 ? "-" : ""}$${formatted.replace("-", "")}` : formatted;
}

export function formatPercent(value, { signed = false } = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = signed && value > 0 ? "+" : "";
  return `${sign}${Number(value).toFixed(1)}%`;
}

export function formatPeriodLabel(periodStr) {
  if (!periodStr) return "—";
  // Handles common backend period label shapes: "2026-02" (monthly),
  // "2026-Q1", "2026-W05", "2026", or plain date strings.
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(periodStr);
  if (monthMatch) {
    const date = new Date(Number(monthMatch[1]), Number(monthMatch[2]) - 1, 1);
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }
  return periodStr;
}

export const PERIOD_OPTIONS = [
  { id: "D", label: "Daily" },
  { id: "W", label: "Weekly" },
  { id: "M", label: "Monthly" },
  { id: "Q", label: "Quarterly" },
  { id: "Y", label: "Yearly" },
];

export const MAX_DIMENSIONS = 3;
