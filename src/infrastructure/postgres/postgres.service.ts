import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { POSTGRES_POOL } from './postgres.config';

@Injectable()
export class PostgresService implements OnModuleDestroy {
    private readonly logger = new Logger(PostgresService.name);

    constructor(@Inject(POSTGRES_POOL) private readonly pool: Pool) {}

    async query<T extends QueryResultRow = QueryResultRow>(
        text: string,
        params: unknown[] = [],
        client?: PoolClient,
    ): Promise<QueryResult<T>> {
        const executor = client ?? this.pool;
        return executor.query<T>(text, params);
    }

    async transaction<T>(
        runner: (client: PoolClient) => Promise<T>,
    ): Promise<T> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await runner(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                this.logger.warn(
                    `Postgres rollback failed: ${
                        rollbackError instanceof Error
                            ? rollbackError.message
                            : String(rollbackError)
                    }`,
                );
            }
            throw error;
        } finally {
            client.release();
        }
    }

    async ping(): Promise<boolean> {
        try {
            await this.pool.query('SELECT 1');
            return true;
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.warn(`Postgres ping failed: ${message}`);
            return false;
        }
    }

    getPool(): Pool {
        return this.pool;
    }

    async onModuleDestroy(): Promise<void> {
        await this.pool.end();
    }
}
