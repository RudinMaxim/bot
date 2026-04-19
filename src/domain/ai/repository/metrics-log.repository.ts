import { Injectable, Logger } from '@nestjs/common';
import { PostgresService } from 'src/infrastructure/postgres';
import { redactForStore } from 'src/shared/security';
import type { IPathLog, ProcessingMetrics } from '../common/types';

/**
 * Roadmap §5: `metrics_log` is write-only observability — no consumer
 * reads the raw text back per row. We hash + truncate at the boundary
 * so the table never holds full prompts.
 */
const METRICS_LOG_PREVIEW_CHARS = 80;

export interface MetricsLogPayload {
    sessionId: string;
    requestText: string;
    responseText: string;
    path: IPathLog;
    metrics: ProcessingMetrics;
    timestamp: string;
}

@Injectable()
export class MetricsLogRepository {
    private readonly logger = new Logger(MetricsLogRepository.name);

    constructor(private readonly postgres: PostgresService) {}

    /**
     * Delete metrics_log rows older than `retentionDays` days.
     * Returns the number of rows actually removed (best-effort — on
     * DB error logs a warning and returns 0 instead of throwing, so a
     * scheduled cron is never poisoned by a transient failure).
     */
    async deleteOlderThan(retentionDays: number): Promise<number> {
        if (!Number.isFinite(retentionDays) || retentionDays <= 0) return 0;
        try {
            const result = await this.postgres.query<{ count: string }>(
                `
                WITH deleted AS (
                    DELETE FROM metrics_log
                    WHERE created_at < now() - ($1 || ' days')::interval
                    RETURNING 1
                )
                SELECT COUNT(*)::text AS count FROM deleted
                `,
                [String(retentionDays)],
            );
            return Number(result.rows[0]?.count ?? 0);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.warn(`Failed to prune metrics_log: ${message}`);
            return 0;
        }
    }

    async save(entry: MetricsLogPayload): Promise<void> {
        const request = redactForStore(entry.requestText, {
            previewChars: METRICS_LOG_PREVIEW_CHARS,
        });
        const response = redactForStore(entry.responseText, {
            previewChars: METRICS_LOG_PREVIEW_CHARS,
        });

        try {
            await this.postgres.query(
                `
                INSERT INTO metrics_log (
                    session_id,
                    request_fingerprint,
                    request_length,
                    request_preview,
                    response_fingerprint,
                    response_length,
                    response_preview,
                    path,
                    metrics,
                    timestamp
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
                `,
                [
                    entry.sessionId,
                    request.fingerprint,
                    request.length,
                    request.preview,
                    response.fingerprint,
                    response.length,
                    response.preview,
                    entry.path,
                    JSON.stringify(entry.metrics),
                    entry.timestamp,
                ],
            );
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.warn(
                `[${entry.sessionId}] Failed to save metrics log: ${message}`,
            );
        }
    }
}
