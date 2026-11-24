const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** Formats an ISO date (YYYY-MM-DD or full ISO string) as "Jan 5, 2026". */
export function formatDate(value: string | number | Date | null | undefined): string {
  if (value == null || value === "") return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return DATE_FORMAT.format(date);
}

/** Formats a p-value in APA style: three decimals, or "< 0.001" below that. */
export function formatPValue(p: number | null | undefined): string {
  if (p == null || Number.isNaN(p)) return "";
  if (p < 0.001) return "< 0.001";
  return p.toFixed(3);
}

/** Formats a p-value with its operator for inline display: "p = 0.032" / "p < 0.001". */
export function formatPValueInline(p: number | null | undefined): string {
  const formatted = formatPValue(p);
  if (!formatted) return "";
  return formatted.startsWith("<") ? `p ${formatted}` : `p = ${formatted}`;
}
