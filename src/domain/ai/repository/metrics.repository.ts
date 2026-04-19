import { Injectable, Logger } from '@nestjs/common';
import { PostgresService } from 'src/infrastructure/postgres';
import {
    AggregatedStats,
    IPathLog,
    IScope,
    type ProcessingMetrics,
} from '../common/types';

interface MetricsStatsRow {
    totalRequests: number | string;
    fastPathRequests: number | string;
    slowPathRequests: number | string;
    errorRequests: number | string;
    totalExecutionTime: number | string;
    totalInputTokens: number | string;
    totalOutputTokens: number | string;
    totalCachedInputTokens: number | string;
    totalTokens: number | string;
    totalLLMCalls: number | string;
    totalInputCostUsd: number | string;
    totalOutputCostUsd: number | string;
    totalCostUsd: number | string;
    lastReset: number | string;
}

@Injectable()
export class MetricsRepository {
    private readonly logger = new Logger(MetricsRepository.name);

    private readonly PREFIX = 'metrics:v1';
    private readonly GLOBAL_KEY = `${this.PREFIX}:global`;
    private readonly SESSION_PREFIX = `${this.PREFIX}:session`;

    constructor(private readonly postgres: PostgresService) {}

    /** -------------------- GLOBAL STATS -------------------- */

    async getGlobalStats(): Promise<AggregatedStats | null> {
        return this.getStatsByKey(this.GLOBAL_KEY);
    }

    async updateGlobalStats(stats: AggregatedStats): Promise<void> {
        await this.upsertStats({
            key: this.GLOBAL_KEY,
            scope: 'global',
            stats,
        });
    }

    async resetGlobalStats(emptyStats: AggregatedStats): Promise<void> {
        await this.upsertStats({
            key: this.GLOBAL_KEY,
            scope: 'global',
            stats: emptyStats,
        });
        this.logger.log('✅ Global metrics reset');
    }

    /** -------------------- SESSION STATS -------------------- */

    async getSessionStats(sessionId: string): Promise<AggregatedStats | null> {
        return this.getStatsByKey(this.getSessionKey(sessionId));
    }

    async updateSessionStats(
        sessionId: string,
        stats: AggregatedStats,
    ): Promise<void> {
        await this.upsertStats({
            key: this.getSessionKey(sessionId),
            scope: 'session',
            sessionId,
            stats,
        });
    }

    async clearSessionStats(sessionId: string): Promise<void> {
        try {
            await this.postgres.query(
                'DELETE FROM metrics_stats WHERE key = $1',
                [this.getSessionKey(sessionId)],
            );
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(
                `Failed to clear session stats (${sessionId}): ${message}`,
            );
        }
    }

    /** -------------------- ATOMIC UPDATES -------------------- */

    async incrementGlobalStats(
        path: IPathLog,
        metrics: ProcessingMetrics,
    ): Promise<void> {
        await this.incrementStats({
            key: this.GLOBAL_KEY,
            scope: 'global',
            path,
            metrics,
        });
    }

    async incrementSessionStats(
        sessionId: string,
        path: IPathLog,
        metrics: ProcessingMetrics,
    ): Promise<void> {
        await this.incrementStats({
            key: this.getSessionKey(sessionId),
            scope: 'session',
            sessionId,
            path,
            metrics,
        });
    }

    /** -------------------- INTERNAL HELPERS -------------------- */

    private async getStatsByKey(key: string): Promise<AggregatedStats | null> {
        try {
            const result = await this.postgres.query<MetricsStatsRow>(
                `
                SELECT
                    total_requests AS "totalRequests",
                    fast_path_requests AS "fastPathRequests",
                    slow_path_requests AS "slowPathRequests",
                    error_requests AS "errorRequests",
                    total_execution_time AS "totalExecutionTime",
                    total_input_tokens AS "totalInputTokens",
                    total_output_tokens AS "totalOutputTokens",
                    total_cached_input_tokens AS "totalCachedInputTokens",
                    total_tokens AS "totalTokens",
                    total_llm_calls AS "totalLLMCalls",
                    total_input_cost_usd AS "totalInputCostUsd",
                    total_output_cost_usd AS "totalOutputCostUsd",
                    total_cost_usd AS "totalCostUsd",
                    last_reset AS "lastReset"
                FROM metrics_stats
                WHERE key = $1
                LIMIT 1
                `,
                [key],
            );

            const row = result.rows[0];
            return row ? this.mapRow(row) : null;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(
                `Failed to fetch metrics stats for key "${key}": ${message}`,
            );
            return null;
        }
    }

    private async upsertStats(params: {
        key: string;
        scope: IScope;
        stats: AggregatedStats;
        sessionId?: string;
    }): Promise<void> {
        try {
            await this.postgres.query(
                `
                INSERT INTO metrics_stats (
                    key,
                    scope,
                    session_id,
                    total_requests,
                    fast_path_requests,
                    slow_path_requests,
                    error_requests,
                    total_execution_time,
                    total_input_tokens,
                    total_output_tokens,
                    total_cached_input_tokens,
                    total_tokens,
                    total_llm_calls,
                    total_input_cost_usd,
                    total_output_cost_usd,
                    total_cost_usd,
                    last_reset
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    $9,
                    $10,
                    $11,
                    $12,
                    $13,
                    $14,
                    $15,
                    $16,
                    $17
                )
                ON CONFLICT (key) DO UPDATE
                SET scope = EXCLUDED.scope,
                    session_id = EXCLUDED.session_id,
                    total_requests = EXCLUDED.total_requests,
                    fast_path_requests = EXCLUDED.fast_path_requests,
                    slow_path_requests = EXCLUDED.slow_path_requests,
                    error_requests = EXCLUDED.error_requests,
                    total_execution_time = EXCLUDED.total_execution_time,
                    total_input_tokens = EXCLUDED.total_input_tokens,
                    total_output_tokens = EXCLUDED.total_output_tokens,
                    total_cached_input_tokens = EXCLUDED.total_cached_input_tokens,
                    total_tokens = EXCLUDED.total_tokens,
                    total_llm_calls = EXCLUDED.total_llm_calls,
                    total_input_cost_usd = EXCLUDED.total_input_cost_usd,
                    total_output_cost_usd = EXCLUDED.total_output_cost_usd,
                    total_cost_usd = EXCLUDED.total_cost_usd,
                    last_reset = EXCLUDED.last_reset,
                    updated_at = now()
                `,
                [
                    params.key,
                    params.scope,
                    params.sessionId ?? null,
                    params.stats.totalRequests,
                    params.stats.fastPathRequests,
                    params.stats.slowPathRequests,
                    params.stats.errorRequests,
                    params.stats.totalExecutionTime,
                    params.stats.totalInputTokens,
                    params.stats.totalOutputTokens,
                    params.stats.totalCachedInputTokens,
                    params.stats.totalTokens,
                    params.stats.totalLLMCalls,
                    params.stats.totalInputCostUsd,
                    params.stats.totalOutputCostUsd,
                    params.stats.totalCostUsd,
                    params.stats.lastReset,
                ],
            );
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(
                `Failed to persist metrics stats for key "${params.key}": ${message}`,
            );
        }
    }

    private async incrementStats(params: {
        key: string;
        scope: IScope;
        sessionId?: string;
        path: IPathLog;
        metrics: ProcessingMetrics;
    }): Promise<void> {
        try {
            const increments = this.buildStatsIncrement(
                params.path,
                params.metrics,
            );

            await this.postgres.query(
                `
                INSERT INTO metrics_stats (
                    key,
                    scope,
                    session_id,
                    total_requests,
                    fast_path_requests,
                    slow_path_requests,
                    error_requests,
                    total_execution_time,
                    total_input_tokens,
                    total_output_tokens,
                    total_cached_input_tokens,
                    total_tokens,
                    total_llm_calls,
                    total_input_cost_usd,
                    total_output_cost_usd,
                    total_cost_usd,
                    last_reset
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    $9,
                    $10,
                    $11,
                    $12,
                    $13,
                    $14,
                    $15,
                    $16,
                    $17
                )
                ON CONFLICT (key) DO UPDATE
                SET scope = EXCLUDED.scope,
                    session_id = EXCLUDED.session_id,
                    total_requests = metrics_stats.total_requests + EXCLUDED.total_requests,
                    fast_path_requests = metrics_stats.fast_path_requests + EXCLUDED.fast_path_requests,
                    slow_path_requests = metrics_stats.slow_path_requests + EXCLUDED.slow_path_requests,
                    error_requests = metrics_stats.error_requests + EXCLUDED.error_requests,
                    total_execution_time = metrics_stats.total_execution_time + EXCLUDED.total_execution_time,
                    total_input_tokens = metrics_stats.total_input_tokens + EXCLUDED.total_input_tokens,
                    total_output_tokens = metrics_stats.total_output_tokens + EXCLUDED.total_output_tokens,
                    total_cached_input_tokens = metrics_stats.total_cached_input_tokens + EXCLUDED.total_cached_input_tokens,
                    total_tokens = metrics_stats.total_tokens + EXCLUDED.total_tokens,
                    total_llm_calls = metrics_stats.total_llm_calls + EXCLUDED.total_llm_calls,
                    total_input_cost_usd = metrics_stats.total_input_cost_usd + EXCLUDED.total_input_cost_usd,
                    total_output_cost_usd = metrics_stats.total_output_cost_usd + EXCLUDED.total_output_cost_usd,
                    total_cost_usd = metrics_stats.total_cost_usd + EXCLUDED.total_cost_usd,
                    updated_at = now(),
                    last_reset = metrics_stats.last_reset
                `,
                [
                    params.key,
                    params.scope,
                    params.sessionId ?? null,
                    increments.totalRequests,
                    increments.fastPathRequests,
                    increments.slowPathRequests,
                    increments.errorRequests,
                    increments.totalExecutionTime,
                    increments.totalInputTokens,
                    increments.totalOutputTokens,
                    increments.totalCachedInputTokens,
                    increments.totalTokens,
                    increments.totalLLMCalls,
                    increments.totalInputCostUsd,
                    increments.totalOutputCostUsd,
                    increments.totalCostUsd,
                    Date.now(),
                ],
            );
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(
                `Failed to increment metrics stats for key "${params.key}": ${message}`,
            );
        }
    }

    private buildStatsIncrement(
        path: IPathLog,
        metrics: ProcessingMetrics,
    ): AggregatedStats {
        const increment: AggregatedStats = {
            totalRequests: 1,
            fastPathRequests: 0,
            slowPathRequests: 0,
            errorRequests: 0,
            totalExecutionTime: metrics.executionTime,
            totalInputTokens: this.toMetricNumber(metrics.inputTokens),
            totalOutputTokens: this.toMetricNumber(metrics.outputTokens),
            totalCachedInputTokens: this.toMetricNumber(
                metrics.cachedInputTokens,
            ),
            totalTokens: this.toMetricNumber(metrics.totalTokens),
            totalLLMCalls: this.toMetricNumber(metrics.llmCalls),
            totalInputCostUsd: this.toMetricNumber(metrics.inputCostUsd),
            totalOutputCostUsd: this.toMetricNumber(metrics.outputCostUsd),
            totalCostUsd: this.toMetricNumber(metrics.totalCostUsd),
            lastReset: 0,
        };

        switch (path) {
            case 'fast':
                increment.fastPathRequests = 1;
                break;
            case 'slow':
                increment.slowPathRequests = 1;
                break;
            case 'error':
                increment.errorRequests = 1;
                break;
        }

        return increment;
    }

    private getSessionKey(sessionId: string): string {
        return `${this.SESSION_PREFIX}:${sessionId}`;
    }

    private mapRow(row: MetricsStatsRow): AggregatedStats {
        const toNumber = (value: number | string): number => {
            if (typeof value === 'number') return value;
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : 0;
        };
        return {
            totalRequests: toNumber(row.totalRequests),
            fastPathRequests: toNumber(row.fastPathRequests),
            slowPathRequests: toNumber(row.slowPathRequests),
            errorRequests: toNumber(row.errorRequests),
            totalExecutionTime: toNumber(row.totalExecutionTime),
            totalInputTokens: toNumber(row.totalInputTokens),
            totalOutputTokens: toNumber(row.totalOutputTokens),
            totalCachedInputTokens: toNumber(row.totalCachedInputTokens),
            totalTokens: toNumber(row.totalTokens),
            totalLLMCalls: toNumber(row.totalLLMCalls),
            totalInputCostUsd: toNumber(row.totalInputCostUsd),
            totalOutputCostUsd: toNumber(row.totalOutputCostUsd),
            totalCostUsd: toNumber(row.totalCostUsd),
            lastReset: toNumber(row.lastReset),
        };
    }

    private toMetricNumber(value: number | undefined): number {
        return Number.isFinite(value) ? Number(value) : 0;
    }
}
