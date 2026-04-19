import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema20260127000000 implements MigrationInterface {
    name = 'InitialSchema20260127000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS widget_locales (
                id BIGSERIAL PRIMARY KEY,
                locale TEXT NOT NULL UNIQUE,
                data JSONB NOT NULL,
                version TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS global_settings (
                id BIGSERIAL PRIMARY KEY,
                key TEXT NOT NULL UNIQUE,
                data JSONB NOT NULL,
                version TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS metrics_stats (
                id BIGSERIAL PRIMARY KEY,
                key TEXT NOT NULL UNIQUE,
                scope TEXT NOT NULL CHECK (scope IN ('global', 'session')),
                session_id TEXT,
                total_requests INTEGER NOT NULL,
                fast_path_requests INTEGER NOT NULL,
                slow_path_requests INTEGER NOT NULL,
                error_requests INTEGER NOT NULL,
                total_execution_time BIGINT NOT NULL,
                total_tokens INTEGER NOT NULL,
                total_llm_calls INTEGER NOT NULL,
                last_reset BIGINT NOT NULL,
                expires_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS metrics_stats_scope_idx
                ON metrics_stats(scope);
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS metrics_stats_session_idx
                ON metrics_stats(session_id);
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS metrics_stats_expires_idx
                ON metrics_stats(expires_at);
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS metrics_log (
                id BIGSERIAL PRIMARY KEY,
                session_id TEXT NOT NULL,
                request_text TEXT NOT NULL,
                response_text TEXT NOT NULL,
                path TEXT NOT NULL CHECK (path IN ('fast', 'slow', 'error')),
                metrics JSONB NOT NULL,
                timestamp TEXT NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS metrics_log_session_idx
                ON metrics_log(session_id);
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS metrics_log_path_idx
                ON metrics_log(path);
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS metrics_log_expires_idx
                ON metrics_log(expires_at);
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS feedback (
                id BIGSERIAL PRIMARY KEY,
                timestamp TEXT NOT NULL,
                session_id TEXT NOT NULL,
                platform TEXT NOT NULL,
                user_id TEXT NOT NULL,
                request_text TEXT NOT NULL,
                response_text TEXT NOT NULL,
                feedback_value INTEGER NOT NULL,
                confidence TEXT NOT NULL,
                agents_used INTEGER NOT NULL,
                processing_time_sec TEXT NOT NULL,
                search_results_count INTEGER NOT NULL,
                analysis_results_count INTEGER NOT NULL,
                has_url TEXT NOT NULL,
                quality_score TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS feedback_created_idx
                ON feedback(created_at DESC);
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS feedback_session_idx
                ON feedback(session_id);
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS feedback_timestamp_idx
                ON feedback(timestamp);
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS action_log (
                id BIGSERIAL PRIMARY KEY,
                task_id TEXT NOT NULL,
                client_name TEXT,
                contact_info TEXT,
                notes TEXT,
                action_type TEXT,
                description TEXT,
                lot_id TEXT,
                appointment_date TEXT,
                status TEXT NOT NULL CHECK (status IN ('completed', 'partial', 'failed')),
                issues TEXT[],
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS action_log_created_idx
                ON action_log(created_at DESC);
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS action_log_status_idx
                ON action_log(status);
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS search_base_catalog (
                id BIGSERIAL PRIMARY KEY,
                locale TEXT NOT NULL,
                document_id TEXT NOT NULL,
                external_id TEXT,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                content TEXT,
                url TEXT,
                source TEXT,
                content_hash TEXT NOT NULL,
                source_updated_at TEXT NOT NULL,
                content_length INTEGER NOT NULL,
                section_count INTEGER,
                sort_order INTEGER,
                vector_id TEXT,
                embedding_status TEXT,
                embedding_error TEXT,
                embedding_updated_at TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                UNIQUE (locale, document_id)
            );
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS search_base_locale_idx
                ON search_base_catalog(locale);
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS search_base_locale_order_idx
                ON search_base_catalog(locale, sort_order, updated_at);
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS search_base_embedding_status_idx
                ON search_base_catalog(embedding_status);
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS search_base_embedding_updated_idx
                ON search_base_catalog(embedding_updated_at);
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS search_base_source_updated_idx
                ON search_base_catalog(source, source_updated_at);
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS site_assistant_action_settings (
                id BIGSERIAL PRIMARY KEY,
                action_name VARCHAR(100) UNIQUE NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT true,
                category VARCHAR(50) NOT NULL,
                description TEXT,
                metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_by VARCHAR(100)
            );
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS site_assistant_action_name_idx
                ON site_assistant_action_settings(action_name);
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS site_assistant_action_active_idx
                ON site_assistant_action_settings(is_active);
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS site_assistant_action_category_idx
                ON site_assistant_action_settings(category);
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS site_assistant_action_updated_idx
                ON site_assistant_action_settings(updated_at);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'DROP TABLE IF EXISTS site_assistant_action_settings',
        );
        await queryRunner.query('DROP TABLE IF EXISTS search_base_catalog');
        await queryRunner.query('DROP TABLE IF EXISTS action_log');
        await queryRunner.query('DROP TABLE IF EXISTS feedback');
        await queryRunner.query('DROP TABLE IF EXISTS metrics_log');
        await queryRunner.query('DROP TABLE IF EXISTS metrics_stats');
        await queryRunner.query('DROP TABLE IF EXISTS global_settings');
        await queryRunner.query('DROP TABLE IF EXISTS widget_locales');
    }
}
