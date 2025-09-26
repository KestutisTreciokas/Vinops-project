/**
 * VIN validation per SSOT:
 * - length 11..17
 * - uppercase A-Z0-9 only
 * - for 17-char standard: exclude I, O, Q
 */
export function normalizeVin(input: string): string {
  return (input || "").trim().toUpperCase();
}

export function isVinValid(input: string): boolean {
  const v = normalizeVin(input);
  if (v.length < 11 || v.length > 17) return false;
  if (!/^[A-Z0-9]+$/.test(v)) return false;
  if (v.length === 17 && /[IOQ]/.test(v)) return false;
  return true;
}
