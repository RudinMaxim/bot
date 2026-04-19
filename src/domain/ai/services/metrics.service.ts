import { Injectable, Logger } from '@nestjs/common';
import {
    AggregatedStats,
    IPathLog,
    PATH_LOG,
    MetricsInput,
    ProcessingMetrics,
    ProcessResult,
} from '../common/types';
import { ResponseAgentOutput } from '../agents';
import { MetricsLogRepository, MetricsRepository } from '../repository';
import { buildProcessingMetrics } from '../common/utils';

@Injectable()
export class MetricsService {
    private readonly logger = new Logger(MetricsService.name);
    constructor(
        private readonly metricsRepository: MetricsRepository,
        private readonly metricsLogRepository: MetricsLogRepository,
    ) {}

    async log(input: MetricsInput): Promise<void> {
        const { sessionId, requestText, result, startTime } = input;

        const metrics = this.extractMetrics(result, startTime);
        const path = this.determinePath(result, metrics);
        const responseText = this.extractResponse(result);

        await Promise.all([
            this.updateGlobalStats(path, metrics),
            this.updateSessionStats(sessionId, path, metrics),
            this.logToStore(
                sessionId,
                requestText,
                responseText,
                path,
                metrics,
            ),
        ]);
    }

    async getStats() {
        const stats = await this.metricsRepository.getGlobalStats();
        return stats ? this.formatStats(stats) : this.getEmptyFormattedStats();
    }

    async getSessionStats(sessionId: string) {
        const stats = await this.metricsRepository.getSessionStats(sessionId);
        return stats ? this.formatStats(stats) : null;
    }

    async resetGlobalStats(): Promise<void> {
        await this.metricsRepository.resetGlobalStats(this.createEmptyStats());
        this.logger.log('Global stats reset');
    }

    async clearSessionStats(sessionId: string): Promise<void> {
        await this.metricsRepository.clearSessionStats(sessionId);
    }

    private async updateGlobalStats(
        path: IPathLog,
        metrics: ProcessingMetrics,
    ): Promise<void> {
        await this.metricsRepository.incrementGlobalStats(path, metrics);
    }

    private async updateSessionStats(
        sessionId: string,
        path: IPathLog,
        metrics: ProcessingMetrics,
    ): Promise<void> {
        await this.metricsRepository.incrementSessionStats(
            sessionId,
            path,
            metrics,
        );
    }

    private async logToStore(
        sessionId: string,
        requestText: string,
        responseText: string,
        path: IPathLog,
        metrics: ProcessingMetrics,
    ): Promise<void> {
        try {
            await this.metricsLogRepository.save({
                timestamp: new Date().toISOString(),
                sessionId,
                requestText,
                responseText,
                path,
                metrics,
            });
        } catch (error) {
            this.logger.warn(`[${sessionId}] Failed to log metrics:`, error);
        }
    }

    private extractMetrics(
        result: ProcessResult<ResponseAgentOutput>,
        startTime: number,
    ): ProcessingMetrics {
        return buildProcessingMetrics({
            data: result.data,
            startTime,
            metadata: result.metadata,
            resultMetrics: result.metrics,
            isError: !result.success,
        });
    }

    private determinePath(
        result: ProcessResult<ResponseAgentOutput>,
        metrics: ProcessingMetrics,
    ): IPathLog {
        if (!result.success) return PATH_LOG.ERROR;
        if (metrics.fastPathUsed) return PATH_LOG.FAST;
        return PATH_LOG.SLOW;
    }

    private extractResponse(
        result: ProcessResult<ResponseAgentOutput>,
    ): string {
        if (!result.success) return result.error || 'Unknown error';
        return result.data?.response || '';
    }

    private formatStats(stats: AggregatedStats) {
        const uptime = Date.now() - stats.lastReset;
        const total = stats.totalRequests || 1;

        return {
            ...stats,
            uptimeMs: uptime,
            avgExecutionTime: stats.totalExecutionTime / total,
            avgInputTokensPerRequest: stats.totalInputTokens / total,
            avgOutputTokensPerRequest: stats.totalOutputTokens / total,
            avgTokensPerRequest: stats.totalTokens / total,
            avgCostUsdPerRequest: stats.totalCostUsd / total,
            fastPathRate: stats.fastPathRequests / total,
            slowPathRate: stats.slowPathRequests / total,
            errorRate: stats.errorRequests / total,
        };
    }

    private getEmptyFormattedStats() {
        return this.formatStats(this.createEmptyStats());
    }

    private createEmptyStats(): AggregatedStats {
        return {
            totalRequests: 0,
            fastPathRequests: 0,
            slowPathRequests: 0,
            errorRequests: 0,
            totalExecutionTime: 0,
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalCachedInputTokens: 0,
            totalTokens: 0,
            totalLLMCalls: 0,
            totalInputCostUsd: 0,
            totalOutputCostUsd: 0,
            totalCostUsd: 0,
            lastReset: Date.now(),
        };
    }
}
