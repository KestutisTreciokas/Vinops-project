import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';

const ALLOWED = new Set<string>([
  'https://vinops.online',
  'https://www.vinops.online',
]);

function allowedOrigin(origin?: string|null): string|undefined {
  if (!origin) return undefined;
  return ALLOWED.has(origin) ? origin : undefined;
}

function baseHeaders(opts: { origin?: string|null; success: boolean }): Record<string,string> {
  const h: Record<string,string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Api-Version': '1',
    'Vary': 'Origin, Accept-Language',
    'Cache-Control': opts.success
      ? 'public, max-age=30, stale-while-revalidate=120'
      : 'no-store, must-revalidate',
    // Для предзапросов и GET всегда объявляем методы/заголовки,
    // чтобы клиентам не приходилось разбирать условия.
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Accept-Language',
  };
  const ao = allowedOrigin(opts.origin);
  if (ao) h['Access-Control-Allow-Origin'] = ao;
  return h;
}

export function okJson(req: NextRequest, body: unknown, extra: Record<string,string> = {}): NextResponse {
  const h = { ...baseHeaders({ origin: req.headers.get('origin'), success: true }), ...extra };
  return NextResponse.json(body, { status: 200, headers: h });
}

export function errJson(
  req: NextRequest,
  status: number,
  code: string,
  message: string,
  extra: Record<string,string> = {}
): NextResponse {
  const traceId = crypto.randomBytes(8).toString('hex');
  const h = { ...baseHeaders({ origin: req.headers.get('origin'), success: false }), ...extra, 'X-Trace-Id': traceId };
  return NextResponse.json({ error: { code, message }, traceId }, { status, headers: h });
}

export function preflight(req: NextRequest): NextResponse {
  // Для надёжности отражаем домен; если Origin не пришёл — отдадим базовый набор без A-C-A-Origin.
  const h = baseHeaders({ origin: req.headers.get('origin') || 'https://vinops.online', success: false });
  h['Access-Control-Max-Age'] = '600';
  // 204 без тела
  return new NextResponse(null, { status: 204, headers: h });
}

// cursor helpers
export function encodeCursor(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}
export function decodeCursor<T=any>(s: string): T | null {
  try { return JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as T; } catch { return null; }
}

// ip helper
export function pickIp(req: NextRequest): string {
  return (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    || req.ip || '0.0.0.0';
}
