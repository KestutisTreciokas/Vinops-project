export function normalizeVin(input: string): string {
  return (input || "").trim().toUpperCase()
}
export function isValidVin(vin: string): boolean {
  const v = normalizeVin(vin)
  if (v.length < 11 || v.length > 17) return false
  if (v.length === 17 && /[IOQ]/.test(v)) return false
  return /^[A-Z0-9]+$/.test(v)
}
