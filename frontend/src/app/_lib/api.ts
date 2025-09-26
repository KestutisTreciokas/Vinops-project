/**
 * Server-side helpers for SSR fetch with strict no-store + language and short timeouts.
 * Used by VIN and Cars pages. Maps API statuses to stable flags for SSR logic.
 */
import { headers } from 'next/headers';

function origin(): string {
  const h = headers();
  const host = h.get('x-forwarded-host') || h.get('host') || '';
  const proto = h.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}

function ensureLang(v: any): 'en' | 'ru' {
  return v === 'ru' ? 'ru' : 'en';
}

function withTimeout(ms: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return {
    signal: ctrl.signal,
    cancel: () => clearTimeout(timer),
  };
}

/**
 * Fetch vehicle for SSR:
 * - 410  -> { __gone: true }
 * - 422  -> { __invalid: true }
 * - 404  -> { __notFound: true }
 * - 2xx  -> parsed JSON
 * - else -> { __error: <status|'aborted'> }
 */
export async function fetchVehicleSSR(vin: string, langIn?: 'en' | 'ru') {
  const lang = ensureLang(langIn);
  const { signal, cancel } = withTimeout(4000);
  try {
    const url = `${origin()}/api/v1/vehicles/${encodeURIComponent(vin)}`;
    const r = await fetch(url, {
      method: 'GET',
      headers: { 'Accept-Language': lang, 'X-SSR': '1' },
      cache: 'no-store',
      next: { revalidate: 0 },
      signal,
    });

    const { status } = r;
    if (status === 410) return { __gone: true };
    if (status === 422) return { __invalid: true };
    if (status === 404) return { __notFound: true };
    if (!r.ok) return { __error: status };

    return await r.json();
  } catch {
    return { __error: 'aborted' };
  } finally {
    cancel();
  }
}

/**
 * Server-side search for /cars (first page SSR):
 * returns API JSON or { items: [], __error?: <status|'aborted'> } on failure.
 */
export async function searchLotsSSR(
  params: Record<string, string | number | boolean | undefined> & { lang?: 'en' | 'ru' },
) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && String(v) !== '') sp.set(k, String(v));
  }
  const lang = ensureLang(params?.lang);

  const { signal, cancel } = withTimeout(4000);
  try {
    const url = `${origin()}/api/v1/search?${sp.toString()}`;
    const r = await fetch(url, {
      method: 'GET',
      headers: { 'Accept-Language': lang, 'X-SSR': '1' },
      cache: 'no-store',
      next: { revalidate: 0 },
      signal,
    });

    if (!r.ok) return { items: [], __error: r.status };
    return await r.json();
  } catch {
    return { items: [], __error: 'aborted' };
  } finally {
    cancel();
  }
}
