import 'pg';

declare module 'pg' {
  interface Pool {
    on(event: 'connect', listener: (client: PoolClient) => void): this;
    on(event: 'acquire', listener: (client: PoolClient) => void): this;
    on(event: 'remove',  listener: (client: PoolClient) => void): this;
    on(event: 'error',   listener: (err: Error, client: PoolClient) => void): this;
  }
}
