import { Injectable, Logger } from '@nestjs/common';
import { PostgresService } from 'src/infrastructure/postgres';
import { FeedbackRow, FeedbackStats } from '../common/types';

@Injectable()
export class FeedbackRepository {
    private readonly logger = new Logger(FeedbackRepository.name);
    constructor(private readonly postgres: PostgresService) {}

    /**
     * Delete feedback rows older than `retentionDays` days. Returns
     * the number of rows actually removed. Errors are swallowed and
     * logged so that a transient DB failure cannot poison the cron.
     */
    async deleteOlderThan(retentionDays: number): Promise<number> {
        if (!Number.isFinite(retentionDays) || retentionDays <= 0) return 0;
        try {
            const result = await this.postgres.query<{ count: string }>(
                `
                WITH deleted AS (
                    DELETE FROM feedback
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
            this.logger.warn(`Failed to prune feedback: ${message}`);
            return 0;
        }
    }

    async save(data: FeedbackRow): Promise<void> {
        try {
            await this.postgres.query(
                `
                INSERT INTO feedback (
                    timestamp,
                    session_id,
                    platform,
                    user_id,
                    request_text,
                    response_text,
                    request_fingerprint,
                    request_length,
                    response_fingerprint,
                    response_length,
                    feedback_value,
                    confidence,
                    agents_used,
                    processing_time_sec,
                    search_results_count,
                    analysis_results_count,
                    has_url,
                    quality_score
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                    $11, $12, $13, $14, $15, $16, $17, $18
                )
                `,
                [
                    data.timestamp,
                    data.sessionId,
                    data.platform,
                    String(data.userId),
                    data.requestText,
                    data.responseText,
                    data.requestFingerprint ?? null,
                    data.requestLength ?? null,
                    data.responseFingerprint ?? null,
                    data.responseLength ?? null,
                    data.feedbackValue,
                    data.confidence,
                    data.agentsUsed,
                    data.processingTimeSec,
                    data.searchResultsCount,
                    data.analysisResultsCount,
                    data.hasUrl,
                    data.qualityScore,
                ],
            );
        } catch (error) {
            this.logger.warn('Failed to save feedback:', error);
            throw error;
        }
    }

    async list(params: {
        page: number;
        limit: number;
    }): Promise<{ items: FeedbackRow[]; total: number }> {
        const page = Math.max(params.page, 1);
        const limit = Math.max(params.limit, 1);
        const skip = (page - 1) * limit;

        const itemsPromise = this.postgres.query<FeedbackRow>(
            `
            SELECT
                timestamp,
                session_id AS "sessionId",
                platform,
                user_id AS "userId",
                request_text AS "requestText",
                response_text AS "responseText",
                request_fingerprint AS "requestFingerprint",
                request_length AS "requestLength",
                response_fingerprint AS "responseFingerprint",
                response_length AS "responseLength",
                feedback_value AS "feedbackValue",
                confidence,
                agents_used AS "agentsUsed",
                processing_time_sec AS "processingTimeSec",
                search_results_count AS "searchResultsCount",
                analysis_results_count AS "analysisResultsCount",
                has_url AS "hasUrl",
                quality_score AS "qualityScore"
            FROM feedback
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
            `,
            [limit, skip],
        );
        const totalPromise = this.postgres.query<{ total: string }>(
            'SELECT COUNT(*)::text AS total FROM feedback',
        );
        const [itemsResult, totalResult] = await Promise.all([
            itemsPromise,
            totalPromise,
        ]);
        const items = itemsResult.rows;
        const total = Number(totalResult.rows[0]?.total ?? 0);

        return { items, total };
    }

    async getStats(): Promise<FeedbackStats> {
        const result = await this.postgres.query<
            Partial<
                Pick<
                    FeedbackRow,
                    'feedbackValue' | 'qualityScore' | 'processingTimeSec'
                >
            >
        >(
            `
            SELECT
                feedback_value AS "feedbackValue",
                quality_score AS "qualityScore",
                processing_time_sec AS "processingTimeSec"
            FROM feedback
            `,
        );

        const rows = result.rows;
        if (!rows.length) {
            return {
                totalFeedback: 0,
                positiveRate: 0,
                avgQualityScore: 0,
                avgProcessingTime: 0,
            };
        }

        const parseNumber = (value?: string): number => {
            if (!value) return 0;
            const normalized = value.replace(',', '.');
            const parsed = Number(normalized);
            return Number.isFinite(parsed) ? parsed : 0;
        };

        let positiveCount = 0;
        let qualitySum = 0;
        let timeSum = 0;

        for (const row of rows) {
            if ((row.feedbackValue ?? 0) > 0) positiveCount++;
            qualitySum += parseNumber(row.qualityScore);
            timeSum += parseNumber(row.processingTimeSec);
        }

        const totalFeedback = rows.length;
        return {
            totalFeedback,
            positiveRate: positiveCount / totalFeedback,
            avgQualityScore: qualitySum / totalFeedback,
            avgProcessingTime: timeSum / totalFeedback,
        };
    }
}
