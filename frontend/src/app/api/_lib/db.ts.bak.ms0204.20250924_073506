import { Pool } from 'pg';

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (_pool) return _pool;

  // Только совместимые с типами поля PoolConfig:
  _pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.PGPOOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.PGPOOL_IDLE_MS || 10_000),
    ssl: process.env.PGSSL_DISABLE === '1' ? undefined : { rejectUnauthorized: true },
  });

  // На каждом подключении выставляем параметры сессии.
  _pool.on('connect', (client) => {
    const appName = "vinops.api.v1";
    const stmtMs  = Number(process.env.PG_STMT_MS  || 0);   // server-side statement_timeout (ms)
    const idleTx  = Number(process.env.PG_IDLE_TX_MS || 3000); // idle_in_transaction_session_timeout (ms)

    const q: string[] = [
      `SET application_name = '${appName}'`,
      `SET idle_in_transaction_session_timeout = ${idleTx}`,
    ];
    if (stmtMs > 0) q.push(`SET statement_timeout = ${stmtMs}`);

    // Последовательно, игнорируя возможные ошибки SET.
    q.reduce((p, sql) => p.then(() => client.query(sql).catch(()=>{})), Promise.resolve());
  });

  _pool.on('error', (err) => {
    console.error('[pg pool error]', (err && (err as any).message) || err);
  });

  return _pool;
}
