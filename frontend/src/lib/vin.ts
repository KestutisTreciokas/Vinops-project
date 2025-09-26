export function isValidVinBasic(vin: string): boolean {
  if (!vin) return false;
  const v = vin.toUpperCase();
  if (v.length < 11 || v.length > 17) return false;
  if (!/^[A-Z0-9]+$/.test(v)) return false;
  if (v.length === 17 && /[IOQ]/.test(v)) return false;
  return true;
}
