import type { Pool, PoolClient } from 'pg';

export const POSTGRES_CONFIG = 'POSTGRES_CONFIG';
export const POSTGRES_POOL = 'POSTGRES_POOL';

export interface PostgresConfig {
    url: string;
    maxPoolSize: number;
    idleTimeoutMs: number;
    connectionTimeoutMs: number;
    ssl: boolean;
}

export type PostgresPool = Pool;
export type PostgresPoolClient = PoolClient;
