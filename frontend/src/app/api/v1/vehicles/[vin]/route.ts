import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { query } from '../../_lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_VERSION = '1';
const ORIGINS = new Set(['https://vinops.online','https://www.vinops.online']);
const RL_LIMIT = 60;
const rl: Map<string, { ts: number; cnt: number }> = (globalThis as any).__vinops_rl || new Map();
(globalThis as any).__vinops_rl = rl;

function nowSec(){ return Math.floor(Date.now()/1000); }
function clientIp(req: NextRequest){
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'anon';
}
function cors(origin: string|null){
  const h: Record<string,string> = {
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, If-None-Match, If-Modified-Since, Accept-Language',
    'Vary': 'Origin, Accept-Language',
    'X-Api-Version': API_VERSION
  };
  if (origin && ORIGINS.has(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}
function normalizeVin(v: string){
  const up = (v||'').toUpperCase().trim();
  if (up.length < 11 || up.length > 17) return { ok:false, reason:'LEN' as const };
  if (!/^[A-Z0-9]+$/.test(up)) return { ok:false, reason:'CHAR' as const };
  if (up.length === 17 && /[IOQ]/.test(up)) return { ok:false, reason:'IOQ' as const };
  return { ok:true, vin: up };
}
function stableStringify(obj: any): string {
  const seen = new WeakSet();
  const sortKeys = (x: any): any => {
    if (x && typeof x === 'object') {
      if (seen.has(x)) return null;
      seen.add(x);
      if (Array.isArray(x)) return x.map(sortKeys);
      return Object.keys(x).sort().reduce((acc: any, k) => { acc[k] = sortKeys(x[k]); return acc; }, {});
    }
    return x;
  };
  return JSON.stringify(sortKeys(obj));
}
function weakETagFrom(obj: unknown) {
  const h = crypto.createHash('sha1').update(stableStringify(obj)).digest('hex');
  return `W/"${h}"`;
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin');
  return new NextResponse(null, { status: 204, headers: cors(origin) });
}

export async function GET(req: NextRequest, ctx: { params: { vin: string } }) {
  const origin = req.headers.get('origin');
  const headers = cors(origin);

  // Rate limit
  const ip = clientIp(req);
  const b = rl.get(ip) || { ts: nowSec(), cnt: 0 };
  if (nowSec() - b.ts >= 60) { b.ts = nowSec(); b.cnt = 0; }
  b.cnt += 1; rl.set(ip, b);
  headers['X-RateLimit-Limit'] = `${RL_LIMIT}`;
  headers['X-RateLimit-Remaining'] = `${Math.max(0, RL_LIMIT - b.cnt)}`;
  headers['X-RateLimit-Reset'] = `${b.ts + 60}`;
  if (b.cnt > RL_LIMIT) {
    return NextResponse.json({ error:{ code:'RATE_LIMIT', message:'Too many requests' }}, { status: 429, headers });
  }

  // VIN validation
  const n = normalizeVin(ctx.params.vin);
  if (!n.ok) {
    headers['Cache-Control'] = 'no-store, must-revalidate';
    return NextResponse.json({ error:{ code:'INVALID_VIN', message:'VIN must be 11–17 uppercase, excluding I/O/Q' }}, { status: 422, headers });
  }
  const vin = n.vin;
  const traceId = crypto.randomUUID();

  // 1) Найти "текущий" лот по VIN (fallback к lots, т.к. ETL vehicles может отставать)
  const lotSql = `
    WITH latest_lot AS (
      SELECT l.*
      FROM lots l
      WHERE l.vin = $1
      ORDER BY COALESCE(l.auction_datetime_utc, l.updated_at) DESC, l.lot_id DESC
      LIMIT 1
    )
    SELECT
      COALESCE(v.vin, l.vin) AS vin,
      COALESCE(v.year, l.year) AS year,
      COALESCE(v.make, l.make) AS make,
      COALESCE(v.model, l.model) AS model,
      v.is_hidden AS v_hidden,
      l.is_hidden AS l_hidden,
      l.lot_id,
      l.status,
      l.source,
      l.location,
      l.auction_datetime_utc,
      GREATEST(
        COALESCE(v.updated_at, 'epoch'::timestamp),
        COALESCE(l.updated_at, 'epoch'::timestamp)
      ) AS last_modified
    FROM latest_lot l
    LEFT JOIN vehicles v ON v.vin = l.vin
  `;
  const lotRes = await query(lotSql, [vin], { traceId });

  if (lotRes.rowCount === 0) {
    headers['Cache-Control'] = 'no-store, must-revalidate';
    return NextResponse.json({ error:{ code:'NOT_FOUND', message:'VIN not found' }}, { status: 404, headers });
  }
  const row = lotRes.rows[0] as any;

  // suppress → 410
  const suppressed = !!(row.v_hidden || row.l_hidden);
  if (suppressed) {
    headers['Cache-Control'] = 'no-store, must-revalidate';
    return NextResponse.json({ status:'suppressed' }, { status: 410, headers });
  }

  const lotId = row.lot_id;

  // 2) Images (метаданные)
  const imgSql = `
    SELECT vin, lot_id, seq, variant, url, COALESCE(updated_at, NOW()) AS updated_at
    FROM images
    WHERE vin = $1 AND lot_id = $2
    ORDER BY seq ASC
  `;
  const imgRes = await query(imgSql, [vin, lotId], { traceId });

  // 3) Последние события продаж (ограничим 10)
  const evSql = `
    SELECT vin, lot_id, sale_date, status, final_bid_usd, COALESCE(updated_at, NOW()) AS updated_at
    FROM sale_events
    WHERE vin = $1
    ORDER BY sale_date DESC
    LIMIT 10
  `;
  const evRes = await query(evSql, [vin], { traceId });

  // Агрегация DTO
  const dto = {
    vin,
    vehicle: {
      vin,
      year: row.year, make: row.make, model: row.model
    },
    currentLot: {
      lotId, source: row.source, status: row.status,
      location: row.location, auctionDateUtc: row.auction_datetime_utc
    },
    images: imgRes.rows.map((r: any) => ({
      vin: r.vin, lotId: r.lot_id, seq: r.seq, variant: r.variant, url: r.url
    })),
    saleEvents: evRes.rows.map((r: any) => ({
      vin: r.vin, lotId: r.lot_id, saleDate: r.sale_date, status: r.status, finalBidUsd: r.final_bid_usd
    }))
  };

  // Headers: cache + ETag + Last-Modified (если есть)
  headers['Cache-Control'] = 'public, max-age=60, stale-while-revalidate=300';
  const etag = weakETagFrom(dto);
  const inm = req.headers.get('if-none-match');
  headers['ETag'] = etag;

  // Last-Modified по максимуму updated_at
  const lastMods: number[] = [];
  if (row.last_modified) lastMods.push(new Date(row.last_modified).getTime());
  if (imgRes.rowCount) {
    const m = Math.max(...imgRes.rows.map((r: any) => new Date(r.updated_at).getTime()));
    if (Number.isFinite(m)) lastMods.push(m);
  }
  if (evRes.rowCount) {
    const m = Math.max(...evRes.rows.map((r: any) => new Date(r.updated_at).getTime()));
    if (Number.isFinite(m)) lastMods.push(m);
  }
  if (lastMods.length) {
    headers['Last-Modified'] = new Date(Math.max(...lastMods)).toUTCString();
  }

  if (inm && inm === etag) {
    return new NextResponse(null, { status: 304, headers });
  }

  return NextResponse.json(dto, { status: 200, headers });
}
