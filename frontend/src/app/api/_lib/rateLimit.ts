/**
 * In-memory token-bucket rate limit per key (ip+route).
 * Strictly for per-process use (one instance per node).
 */
type Bucket = { ts: number; cnt: number };
const buckets: Map<string, Bucket> = (globalThis as any).__vinops_rl || new Map();
(globalThis as any).__vinops_rl = buckets;

export function allow(key: string, limitPerMinute: number): { allowed: boolean; remaining: number; reset: number } {
  const now = Math.floor(Date.now() / 1000);
  const b = buckets.get(key) || { ts: now, cnt: 0 };
  if (now - b.ts >= 60) { b.ts = now; b.cnt = 0; }
  b.cnt += 1;
  buckets.set(key, b);
  return { allowed: b.cnt <= limitPerMinute, remaining: Math.max(0, limitPerMinute - b.cnt), reset: b.ts + 60 };
}
