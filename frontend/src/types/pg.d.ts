declare module 'pg' {
  export interface QueryConfig { text: string; values?: any[]; name?: string }
  export interface QueryResult<T=any> { rows: T[]; rowCount: number }
  export class PoolClient {
    query<T=any>(q: string | QueryConfig, values?: any[]): Promise<QueryResult<T>>;
    release(err?: any): void;
  }
  export interface PoolConfig {
    connectionString?: string;
    host?: string; port?: number; user?: string; password?: string; database?: string;
    ssl?: false | { rejectUnauthorized: boolean; ca?: string; servername?: string };
    max?: number; idleTimeoutMillis?: number;
  }
  export class Pool {
    constructor(cfg?: PoolConfig);
    query<T=any>(q: string | QueryConfig, values?: any[]): Promise<QueryResult<T>>;
    connect(): Promise<PoolClient>;
    on(ev: 'connect' | 'error', cb: (...args:any[])=>void): this;
  }
}
