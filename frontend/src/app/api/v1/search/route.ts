import { NextRequest, NextResponse } from 'next/server';
import { getPool, hasDb } from '../../_lib/db';
import { allow } from '../../_lib/rateLimit';
import { okJson, errJson, pickIp } from '../../_lib/http';
import { normLang, type Lang, labelStatus, labelDamage, labelTitle } from '../../_lib/i18n';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Canonical row shape for stub/DB mapping */
type LotRow = {
  lot_id: number;
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  status: string | null;                // EN code
  auction_datetime_utc: string | null;  // ISO
  est_retail_value_usd: number | null;
  runs_drives: boolean | null;
  has_keys: boolean | null;
  primary_image_url: string | null;
  image_count: number | null;
  primary_damage: string | null;        // EN code
  title_brand: string | null;           // EN code
};

type Cursor = { dir: 'asc'|'desc'; ts: string; id: number };

function strictDecodeCursor(raw: string): Cursor | null {
  try {
    const obj = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if ((obj.dir === 'asc' || obj.dir === 'desc') && typeof obj.ts === 'string' && typeof obj.id === 'number') {
      return obj as Cursor;
    }
    return null;
  } catch { return null; }
}
function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c), 'utf8').toString('base64url');
}

function parseBool(v: string | null): boolean | null {
  if (v == null) return null;
  const t = v.toLowerCase();
  if (t === 'true') return true;
  if (t === 'false') return false;
  return null; // invalid -> let validator decide
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allow =
    origin === 'https://vinops.online' || origin === 'https://www.vinops.online'
      ? origin : undefined;
  const h: Record<string, string> = {
    Vary: 'Origin, Accept-Language',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Accept-Language',
  };
  if (allow) h['Access-Control-Allow-Origin'] = allow;
  return h;
}

export async function OPTIONS(req: NextRequest) {
  const h = new Headers(corsHeaders(req.headers.get('origin')));
  h.set('Access-Control-Max-Age', '600');
  return new NextResponse(null, { status: 204, headers: h });
}

/* ---- Helpers for aliases and sort ---- */
function getStr(sp: URLSearchParams, a: string, b?: string): string | null {
  return sp.get(a) ?? (b ? sp.get(b) : null);
}
function getInt(sp: URLSearchParams, a: string, b?: string): number | null {
  const raw = getStr(sp, a, b);
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}
function getBoolStr(sp: URLSearchParams, a: string, b?: string): string | null {
  return getStr(sp, a, b);
}
function resolveSort(sp: URLSearchParams): 'asc'|'desc' {
  const s = sp.get('sort');
  if (!s) return 'desc';
  if (s === 'asc' || s === 'desc') return s;
  if (s === '+auctionDateTimeUtc') return 'asc';
  if (s === '-auctionDateTimeUtc') return 'desc';
  return 'desc';
}

/* ---- Deterministic smoke-stub dataset (until DAL is connected) ---- */
const STUB_ROWS: LotRow[] = [
  {
    lot_id: 101,
    vin: '4T1B11HK5JU123456',
    year: 2018,
    make: 'TOYOTA',
    model: 'CAMRY',
    trim: 'SE',
    status: 'ACTIVE',
    auction_datetime_utc: '2025-10-01T15:00:00Z',
    est_retail_value_usd: 16250,
    runs_drives: true,
    has_keys: true,
    primary_image_url: 'https://img.vinops.online/demo/101-xl.jpg',
    image_count: 12,
    primary_damage: 'FRONT_END',
    title_brand: 'SALVAGE',
  },
  {
    lot_id: 102,
    vin: 'WBA5R1C06LF123456',
    year: 2020,
    make: 'BMW',
    model: '330I',
    trim: 'SPORT',
    status: 'ACTIVE',
    auction_datetime_utc: '2025-09-30T13:00:00Z',
    est_retail_value_usd: 23800,
    runs_drives: true,
    has_keys: false,
    primary_image_url: 'https://img.vinops.online/demo/102-xl.jpg',
    image_count: 9,
    primary_damage: 'REAR_END',
    title_brand: 'SALVAGE',
  },
  {
    lot_id: 103,
    vin: '1FTEW1EG7GFA12345',
    year: 2016,
    make: 'FORD',
    model: 'F-150',
    trim: 'LARIAT',
    status: 'ACTIVE',
    auction_datetime_utc: '2025-09-29T17:30:00Z',
    est_retail_value_usd: 28500,
    runs_drives: false,
    has_keys: true,
    primary_image_url: 'https://img.vinops.online/demo/103-xl.jpg',
    image_count: 15,
    primary_damage: 'FRONT_END',
    title_brand: 'CLEAR',
  },
];

function cmpDesc(a: LotRow, b: LotRow): number {
  const ta = a.auction_datetime_utc ?? '1970-01-01T00:00:00Z';
  const tb = b.auction_datetime_utc ?? '1970-01-01T00:00:00Z';
  if (ta !== tb) return ta > tb ? -1 : 1;
  return b.lot_id - a.lot_id;
}
function cmpAsc(a: LotRow, b: LotRow): number {
  const ta = a.auction_datetime_utc ?? '1970-01-01T00:00:00Z';
  const tb = b.auction_datetime_utc ?? '1970-01-01T00:00:00Z';
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.lot_id - b.lot_id;
}
function keyAfter(c: Cursor, row: LotRow): boolean {
  const t = row.auction_datetime_utc ?? '1970-01-01T00:00:00Z';
  if (c.dir === 'desc') {
    return (t < c.ts) || (t === c.ts && row.lot_id < c.id);
  } else {
    return (t > c.ts) || (t === c.ts && row.lot_id > c.id);
  }
}

export async function GET(req: NextRequest) {
  /* TRY_GUARD_START */
  try {
  // === Rate limit per-IP ===
  const ip = pickIp(req);
  const rl = await allow(`s:search:${ip}`, 60);
  if (!rl.allowed) {
    return errJson(req, 429, 'rate_limited', 'Too Many Requests', {
      'X-RateLimit-Limit': '60',
      'X-RateLimit-Remaining': String(rl.remaining),
      'X-RateLimit-Reset': String(rl.reset),
    });
  }

  const url = new URL(req.url);
  const sp = url.searchParams;

  // lang param or Accept-Language
  const langParam = sp.get('lang');
  const lang: Lang = (langParam === 'ru' || langParam === 'en') ? langParam : normLang(req.headers.get('accept-language'));

  // limit (1..50; default 20)
  const rawLimit = sp.get('limit');
  let limit = 20;
  if (rawLimit != null) {
    const n = Number(rawLimit);
    if (!Number.isFinite(n) || n < 1) {
      return errJson(req, 400, 'bad_request', 'limit must be >=1 and <=50', {
        'X-RateLimit-Limit': '60',
        'X-RateLimit-Remaining': String(rl.remaining),
        'X-RateLimit-Reset': String(rl.reset),
      });
    }
    limit = Math.min(n, 50);
  }

  // aliases (snakeCase & camelCase)
  const make  = getStr(sp, 'make');
  const model = getStr(sp, 'model');

  const yearFrom = getInt(sp, 'year_from', 'yearFrom');
  const yearTo   = getInt(sp, 'year_to',   'yearTo');
  if (Number.isNaN(yearFrom) || Number.isNaN(yearTo)) {
    return errJson(req, 400, 'bad_request', 'year_from/year_to must be numbers', {
      'X-RateLimit-Limit': '60',
      'X-RateLimit-Remaining': String(rl.remaining),
      'X-RateLimit-Reset': String(rl.reset),
    });
  }
  if ((yearFrom ?? -Infinity) > (yearTo ?? Infinity)) {
    return errJson(req, 422, 'invalid_range', 'year_from must be <= year_to', {
      'X-RateLimit-Limit': '60',
      'X-RateLimit-Remaining': String(rl.remaining),
      'X-RateLimit-Reset': String(rl.reset),
    });
  }

  const damageCode = getStr(sp, 'damage', 'primaryDamageCode');
  const titleCode  = getStr(sp, 'title_brand', 'titleBrand');

  const runsStr = getBoolStr(sp, 'runs_drives', 'runsDrives');
  const haskStr = getBoolStr(sp, 'has_keys', 'hasKeys');
  const runsDrives = parseBool(runsStr);
  const hasKeys    = parseBool(haskStr);
  if (runsStr != null && runsDrives == null) {
    return errJson(req, 400, 'bad_request', 'runs_drives must be true|false', {
      'X-RateLimit-Limit': '60',
      'X-RateLimit-Remaining': String(rl.remaining),
      'X-RateLimit-Reset': String(rl.reset),
    });
  }
  if (haskStr != null && hasKeys == null) {
    return errJson(req, 400, 'bad_request', 'has_keys must be true|false', {
      'X-RateLimit-Limit': '60',
      'X-RateLimit-Remaining': String(rl.remaining),
      'X-RateLimit-Reset': String(rl.reset),
    });
  }

  const sort: 'asc'|'desc' = resolveSort(sp);
  const cursorRaw = sp.get('cursor');
  const cursor = cursorRaw ? strictDecodeCursor(cursorRaw) : null;
  if (cursorRaw && !cursor) {
    return errJson(req, 422, 'invalid_cursor', 'cursor is malformed', {
      'X-RateLimit-Limit': '60',
      'X-RateLimit-Remaining': String(rl.remaining),
      'X-RateLimit-Reset': String(rl.reset),
    });
  }

  // CORS + version + cache headers
  const baseHeaders = {
    ...corsHeaders(req.headers.get('origin')),
    'Content-Type': 'application/json; charset=utf-8',
    'X-Api-Version': '1',
  };
  const okCache = { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=120' };
  const errCache = { 'Cache-Control': 'no-store, must-revalidate' };
  const rlHeaders = {
    'X-RateLimit-Limit': '60',
    'X-RateLimit-Remaining': String(rl.remaining),
    'X-RateLimit-Reset': String(rl.reset),
  };

  // --- DB path (read-only) — подключим в MS-02-02; сейчас возвращаем stub как истину ---
  // const dbAvailable = await hasDb();
  const dbAvailable = false;

  if (!dbAvailable) {
    let rows = STUB_ROWS.slice(0);

    // filters
    if (make)  rows = rows.filter(r => (r.make ?? '').toUpperCase() === make.toUpperCase());
    if (model) rows = rows.filter(r => (r.model ?? '').toUpperCase() === model.toUpperCase());
    if (yearFrom != null) rows = rows.filter(r => (r.year ?? -Infinity) >= (yearFrom as number));
    if (yearTo   != null) rows = rows.filter(r => (r.year ??  Infinity) <= (yearTo   as number));
    if (damageCode) rows = rows.filter(r => (r.primary_damage ?? '').toUpperCase() === damageCode.toUpperCase());
    if (titleCode)  rows = rows.filter(r => (r.title_brand    ?? '').toUpperCase() === titleCode.toUpperCase());
    if (runsDrives != null) rows = rows.filter(r => r.runs_drives === runsDrives);
    if (hasKeys    != null) rows = rows.filter(r => r.has_keys    === hasKeys);

    // sort and cursor
    rows.sort(sort === 'desc' ? cmpDesc : cmpAsc);
    if (cursor) rows = rows.filter(r => keyAfter(cursor, r));

    const page = rows.slice(0, limit);
    let nextCursor: string | null = null;
    if (rows.length > limit) {
      const last = page[page.length - 1]!;
      nextCursor = encodeCursor({ dir: sort, ts: last.auction_datetime_utc ?? '1970-01-01T00:00:00Z', id: last.lot_id });
    }

    const items = page.map(r => ({
      lotId: r.lot_id,
      vin: r.vin,
      year: r.year,
      make: r.make,
      model: r.model,
      trim: r.trim,
      statusCode: r.status,
      status: r.status ? labelStatus(r.status, lang) : null,
      auctionDateTimeUtc: r.auction_datetime_utc,
      estRetailValueUsd: r.est_retail_value_usd,
      runsDrives: r.runs_drives,
      hasKeys: r.has_keys,
      primaryImageUrl: r.primary_image_url,
      imageCount: r.image_count,
      primaryDamageCode: r.primary_damage,
      primaryDamage: r.primary_damage ? labelDamage(r.primary_damage, lang) : null,
      titleBrandCode: r.title_brand,
      titleBrand: r.title_brand ? labelTitle(r.title_brand, lang) : null,
    }));

    const headers = { ...baseHeaders, ...okCache, ...rlHeaders, 'X-Fallback': 'stub' };
    return okJson(req, { items, nextCursor }, headers);
  }

  // --- DB path skeleton (not executed in this MS) ---
  try {
    const pool = await getPool();
    const client = await pool.connect();
    try {
      // placeholder: not implemented; return no content but typed payload (stub covers functionality)
      const headers = { ...baseHeaders, ...okCache, ...rlHeaders, 'X-Fallback': 'db-not-implemented' };
      return okJson(req, { items: [], nextCursor: null }, headers);
    } finally {
      client.release();
    }
  } catch (e) {
    const headers = { ...baseHeaders, ...errCache, ...rlHeaders };
    return errJson(req, 500, 'internal_error', 'Internal Server Error', headers);
  }
  } catch (e) {
    const h: Record<string,string> = {
      Vary: "Origin, Accept-Language", "X-Api-Version": "1", "Cache-Control": "no-store, must-revalidate"
    };
    // Best-effort CORS echo (origin may be null):
    const o = req.headers.get("origin");
    if (o === "https://vinops.online" || o === "https://www.vinops.online") h["Access-Control-Allow-Origin"] = o;
    return new Response(JSON.stringify({ error: { code: "internal", message: "Internal Server Error" } }), { status: 500, headers: h });
  }
  /* TRY_GUARD_END */
}
