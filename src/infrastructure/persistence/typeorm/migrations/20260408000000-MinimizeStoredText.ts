import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Roadmap §5 — data minimization for stored user-facing text.
 *
 * Why
 * ---
 *  - `metrics_log` historically stored full `request_text` / `response_text`,
 *    even though no consumer ever reads them back per row (the table is
 *    write-only observability; aggregates live in `metrics_stats`). Holding
 *    raw prompts indefinitely is a PII liability with no upside, so the
 *    sensitive columns are dropped and replaced with non-reversible
 *    fingerprint + length + a tiny preview that's still useful for triage.
 *
 *  - `feedback` IS read back (admin triages thumbs-down responses), so we
 *    can't drop the text columns outright. Instead the application layer
 *    truncates new rows to 240 chars before INSERT, and we add fingerprint
 *    + length columns so admins can still group "same prompt" rows. Old
 *    rows are left intact and will age out via the existing retention cron
 *    (per agreement, no backfill).
 *
 * Carve-outs intentionally NOT touched here (documented in roadmap §5):
 *
 *  - `action_log` is a task queue for back-office, not a log. `client_name`,
 *    `contact_info`, `notes` are the entire feature. Removing them would
 *    break the integration.
 *  - Redis message cache has TTL=3600s and is what the widget reads as
 *    history. Already minimal and short-lived.
 */
export class MinimizeStoredText20260408000000 implements MigrationInterface {
    name = 'MinimizeStoredText20260408000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ── metrics_log: drop raw text, add fingerprint/length/preview ──
        await queryRunner.query(`
            ALTER TABLE metrics_log
            ADD COLUMN IF NOT EXISTS request_fingerprint TEXT NOT NULL DEFAULT '',
            ADD COLUMN IF NOT EXISTS request_length INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS request_preview TEXT NOT NULL DEFAULT '',
            ADD COLUMN IF NOT EXISTS response_fingerprint TEXT NOT NULL DEFAULT '',
            ADD COLUMN IF NOT EXISTS response_length INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS response_preview TEXT NOT NULL DEFAULT ''
        `);
        await queryRunner.query(`
            ALTER TABLE metrics_log
            DROP COLUMN IF EXISTS request_text,
            DROP COLUMN IF EXISTS response_text
        `);

        // ── feedback: keep raw columns, add fingerprint/length sidecar ──
        // Nullable on purpose: existing rows are not backfilled and the
        // retention cron will eventually evict them.
        await queryRunner.query(`
            ALTER TABLE feedback
            ADD COLUMN IF NOT EXISTS request_fingerprint TEXT,
            ADD COLUMN IF NOT EXISTS request_length INTEGER,
            ADD COLUMN IF NOT EXISTS response_fingerprint TEXT,
            ADD COLUMN IF NOT EXISTS response_length INTEGER
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE feedback
            DROP COLUMN IF EXISTS response_length,
            DROP COLUMN IF EXISTS response_fingerprint,
            DROP COLUMN IF EXISTS request_length,
            DROP COLUMN IF EXISTS request_fingerprint
        `);

        await queryRunner.query(`
            ALTER TABLE metrics_log
            ADD COLUMN IF NOT EXISTS request_text TEXT NOT NULL DEFAULT '',
            ADD COLUMN IF NOT EXISTS response_text TEXT NOT NULL DEFAULT ''
        `);
        await queryRunner.query(`
            ALTER TABLE metrics_log
            DROP COLUMN IF EXISTS response_preview,
            DROP COLUMN IF EXISTS response_length,
            DROP COLUMN IF EXISTS response_fingerprint,
            DROP COLUMN IF EXISTS request_preview,
            DROP COLUMN IF EXISTS request_length,
            DROP COLUMN IF EXISTS request_fingerprint
        `);
    }
}
