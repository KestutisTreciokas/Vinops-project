export function buildQuery(base: URLSearchParams, next: Record<string, string | null | undefined>) {
  const q = new URLSearchParams(base.toString())
  for (const [k, v] of Object.entries(next)) {
    if (v === undefined || v === null || v === '') q.delete(k)
    else q.set(k, v)
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}
