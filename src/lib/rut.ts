/** Chilean RUT helpers. */

/** Clean any string to RUT digits + DV (no dots, no dash), uppercased. */
export function cleanRut(input: string | null | undefined): string {
  if (!input) return "";
  return input.replace(/[^0-9kK]/g, "").toUpperCase();
}

/** Compute the "módulo 11" check digit for the given numeric body. */
export function computeDv(body: string): string {
  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const res = 11 - (sum % 11);
  if (res === 11) return "0";
  if (res === 10) return "K";
  return String(res);
}

/** Basic RUT validation. Returns true if body >= 7 digits and DV matches. */
export function isValidRut(input: string | null | undefined): boolean {
  const raw = cleanRut(input);
  if (raw.length < 8) return false;
  const body = raw.slice(0, -1);
  const dv = raw.slice(-1);
  if (!/^\d+$/.test(body)) return false;
  return computeDv(body) === dv;
}

/** Format 12345678K → 12.345.678-K. */
export function formatRut(input: string | null | undefined): string {
  const raw = cleanRut(input);
  if (raw.length < 2) return raw;
  const body = raw.slice(0, -1);
  const dv = raw.slice(-1);
  const withDots = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${withDots}-${dv}`;
}

/** Extract every RUT-like token from a free-form string. */
export function extractRuts(text: string): string[] {
  const out: string[] = [];
  const re = /(\d{1,3}(?:\.\d{3}){1,2}-[\dkK]|\d{7,9}-?[\dkK])/g;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) != null) {
    const clean = cleanRut(m[1]);
    if (clean.length >= 8 && !seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
  }
  return out;
}