export function formatCLP(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null) return "—";
  if (currency === "UF") {
    return `${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(amount)} UF`;
  }
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  }
  return formatCLP(amount);
}

/**
 * Format a date without any timezone shifting. When given a YYYY-MM-DD ISO
 * string, the pieces are parsed directly — we never build a `Date` from the
 * string (which would parse as UTC midnight and can shift a day in local TZ).
 */
export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  if (typeof iso === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    return iso;
  }
  const d = iso;
  const day = String(d.getDate()).padStart(2, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}-${mo}-${d.getFullYear()}`;
}
