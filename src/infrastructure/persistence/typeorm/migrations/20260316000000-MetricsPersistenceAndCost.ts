import { MigrationInterface, QueryRunner } from 'typeorm';

export class MetricsPersistenceAndCost20260316000000
    implements MigrationInterface
{
    name = 'MetricsPersistenceAndCost20260316000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE metrics_stats
            ALTER COLUMN total_requests TYPE BIGINT
        `);
        await queryRunner.query(`
            ALTER TABLE metrics_stats
            ALTER COLUMN fast_path_requests TYPE BIGINT
        `);
        await queryRunner.query(`
            ALTER TABLE metrics_stats
            ALTER COLUMN slow_path_requests TYPE BIGINT
        `);
        await queryRunner.query(`
            ALTER TABLE metrics_stats
            ALTER COLUMN error_requests TYPE BIGINT
        `);
        await queryRunner.query(`
            ALTER TABLE metrics_stats
            ALTER COLUMN total_tokens TYPE BIGINT
        `);
        await queryRunner.query(`
            ALTER TABLE metrics_stats
            ALTER COLUMN total_llm_calls TYPE BIGINT
        `);
        await queryRunner.query(`
            ALTER TABLE metrics_stats
            ADD COLUMN IF NOT EXISTS total_input_tokens BIGINT NOT NULL DEFAULT 0
        `);
        await queryRunner.query(`
            ALTER TABLE metrics_stats
            ADD COLUMN IF NOT EXISTS total_output_tokens BIGINT NOT NULL DEFAULT 0
        `);
        await queryRunner.query(`
            ALTER TABLE metrics_stats
            ADD COLUMN IF NOT EXISTS total_cached_input_tokens BIGINT NOT NULL DEFAULT 0
        `);
        await queryRunner.query(`
            ALTER TABLE metrics_stats
            ADD COLUMN IF NOT EXISTS total_input_cost_usd NUMERIC(18, 8) NOT NULL DEFAULT 0
        `);
        await queryRunner.query(`
            ALTER TABLE metrics_stats
            ADD COLUMN IF NOT EXISTS total_output_cost_usd NUMERIC(18, 8) NOT NULL DEFAULT 0
        `);
        await queryRunner.query(`
            ALTER TABLE metrics_stats
            ADD COLUMN IF NOT EXISTS total_cost_usd NUMERIC(18, 8) NOT NULL DEFAULT 0
        `);
        await queryRunner.query(`
            UPDATE metrics_stats
            SET expires_at = NULL
            WHERE scope = 'session'
        `);
        await queryRunner.query(`
            ALTER TABLE metrics_log
            ALTER COLUMN expires_at DROP NOT NULL
        `);
        await queryRunner.query(`
            UPDATE metrics_log
            SET expires_at = NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE metrics_log
            SET expires_at = now()
            WHERE expires_at IS NULL
        `);
        await queryRunner.query(`
            ALTER TABLE metrics_log
            ALTER COLUMN expires_at SET NOT NULL
        `);
        await queryRunner.query(`
            ALTER TABLE metrics_stats
            DROP COLUMN IF EXISTS total_cost_usd
        `);
        await queryRunner.query(`
            ALTER TABLE metrics_stats
            DROP COLUMN IF EXISTS total_output_cost_usd
        `);
        await queryRunner.query(`
            ALTER TABLE metrics_stats
            DROP COLUMN IF EXISTS total_input_cost_usd
        `);
        await queryRunner.query(`
            ALTER TABLE metrics_stats
            DROP COLUMN IF EXISTS total_cached_input_tokens
        `);
        await queryRunner.query(`
            ALTER TABLE metrics_stats
            DROP COLUMN IF EXISTS total_output_tokens
        `);
        await queryRunner.query(`
            ALTER TABLE metrics_stats
            DROP COLUMN IF EXISTS total_input_tokens
        `);
        await queryRunner.query(`
            ALTER TABLE metrics_stats
            ALTER COLUMN total_llm_calls TYPE INTEGER
        `);
        await queryRunner.query(`
            ALTER TABLE metrics_stats
            ALTER COLUMN total_tokens TYPE INTEGER
        `);
        await queryRunner.query(`
            ALTER TABLE metrics_stats
            ALTER COLUMN error_requests TYPE INTEGER
        `);
        await queryRunner.query(`
            ALTER TABLE metrics_stats
            ALTER COLUMN slow_path_requests TYPE INTEGER
        `);
        await queryRunner.query(`
            ALTER TABLE metrics_stats
            ALTER COLUMN fast_path_requests TYPE INTEGER
        `);
        await queryRunner.query(`
            ALTER TABLE metrics_stats
            ALTER COLUMN total_requests TYPE INTEGER
        `);
    }
}
