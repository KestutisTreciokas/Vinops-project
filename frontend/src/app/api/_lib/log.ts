export type LogKV = Record<string, unknown>;
export function jlog(event: string, kv: LogKV = {}) {
  const rec = { ts: new Date().toISOString(), event, ...kv };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(rec));
}
