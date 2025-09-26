import { Pool, PoolClient, QueryResult } from 'pg';

type Ctx = { traceId?: string; requestId?: string };

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (_pool) return _pool;
  const cs = process.env.DATABASE_URL;
  if (!cs) throw new Error('DATABASE_URL is not set');
  _pool = new Pool({
    connectionString: cs,
    ssl: { rejectUnauthorized: true },
  });
  _pool.on('connect', async (client: PoolClient) => {
    // Session GUC (read-only + sane timeouts + UTC + app name)
    await client.query(`SET TIME ZONE 'UTC'`);
    await client.query(`SET application_name TO 'vinops.frontend'`);
    await client.query(`SET default_transaction_read_only = on`);
    await client.query(`SET statement_timeout = '2000ms'`);
    await client.query(`SET lock_timeout = '1000ms'`);
    await client.query(`SET idle_in_transaction_session_timeout = '5000ms'`);
  });
  return _pool;
}

const READONLY_RE = /^\s*(select|with)\b/i;

export async function query<T = any>(
  sql: string,
  params: any[] = [],
  ctx: Ctx = {}
): Promise<QueryResult<T>> {
  if (!READONLY_RE.test(sql)) {
    console.log(JSON.stringify({
      lvl: 'warn', msg: 'db.query.block', code: 'READONLY_GUARD',
      sql: sql.slice(0, 120), traceId: ctx.traceId || null, requestId: ctx.requestId || null
    }));
    throw new Error('READONLY_GUARD: only SELECT/WITH allowed');
  }
  const pool = getPool();
  const t0 = Date.now();
  try {
    const res = await pool.query<T>(sql, params);
    console.log(JSON.stringify({
      lvl: 'info', msg: 'db.query.ok', durMs: Date.now() - t0,
      rowCount: res.rowCount, traceId: ctx.traceId || null, requestId: ctx.requestId || null
    }));
    return res;
  } catch (e: any) {
    const durMs = Date.now() - t0;
    console.log(JSON.stringify({
      lvl: 'error', msg: 'db.query.fail', durMs, error: e.code || e.message,
      traceId: ctx.traceId || null, requestId: ctx.requestId || null
    }));
    // one light retry on transient db errors
    const code = e.code || '';
    if (/(40001|55P03|53300|53400|57P01|57P03)/.test(code)) {
      await new Promise(r => setTimeout(r, 100));
      const res = await pool.query<T>(sql, params);
      console.log(JSON.stringify({
        lvl: 'info', msg: 'db.query.retry_ok', durMs: Date.now() - t0,
        rowCount: res.rowCount, traceId: ctx.traceId || null, requestId: ctx.requestId || null
      }));
      return res;
    }
    throw e;
  }
}

export function hasDb(): boolean {
  return !!process.env.DATABASE_URL;
}
