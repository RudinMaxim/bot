import { Injectable, Logger } from '@nestjs/common';
import { redactForStore } from 'src/shared/security';
import { FeedbackRepository } from '../repository';
import { FeedbackInput } from '../common/types';
import { AGENT_PRIORITY, AI_STATUS } from '../common/constants';

/**
 * Roadmap §5: feedback rows are read by admins for triage, so we keep
 * a preview — but only a preview. 240 chars is enough to understand the
 * gist of a thumbs-down ("the bot got the price wrong on lot 14"); the
 * fingerprint covers grouping needs.
 */
const FEEDBACK_PREVIEW_CHARS = 240;

const SCORE_WEIGHTS = {
    feedback: 40,
    confidence: 30,
    hasResults: 20,
    fastResponse: 10,
    moderateResponse: 5,
} as const;

const QUALITY_THRESHOLDS = {
    excellent: 80,
    good: 60,
    fair: 40,
} as const;

const RESPONSE_TIME_FAST_MS = 5000;
const RESPONSE_TIME_MODERATE_MS = 10000;

@Injectable()
export class FeedbackService {
    private readonly logger = new Logger(FeedbackService.name);

    constructor(private readonly feedbackRepository: FeedbackRepository) {}

    async log(input: FeedbackInput): Promise<void> {
        const {
            sessionId,
            requestText,
            responseText,
            feedbackValue,
            metadata,
        } = input;

        if (!this.validateMetadata(metadata)) {
            this.logger.warn(`[${sessionId}] Invalid feedback metadata`);
            return;
        }

        const qualityScore = this.calculateQualityScore(
            metadata,
            feedbackValue,
        );
        const qualityLevel = this.getQualityLevel(qualityScore);

        const request = redactForStore(requestText, {
            previewChars: FEEDBACK_PREVIEW_CHARS,
        });
        const response = redactForStore(responseText, {
            previewChars: FEEDBACK_PREVIEW_CHARS,
        });

        await this.feedbackRepository.save({
            timestamp: new Date().toISOString(),
            sessionId,
            platform: metadata.platform || AI_STATUS.UNKNOWN,
            userId: metadata.userId || AI_STATUS.UNKNOWN,
            requestText: request.preview,
            responseText: response.preview,
            requestFingerprint: request.fingerprint,
            requestLength: request.length,
            responseFingerprint: response.fingerprint,
            responseLength: response.length,
            feedbackValue,
            confidence: metadata.confidence || AI_STATUS.UNKNOWN,
            agentsUsed: metadata.agentsUsed || 0,
            processingTimeSec: this.formatProcessingTime(
                metadata.processingTimeMs,
            ),
            searchResultsCount: metadata.searchResultsCount || 0,
            analysisResultsCount: metadata.analysisResultsCount || 0,
            hasUrl: metadata.hasUrl ? 'да' : 'нет',
            qualityScore: qualityScore.toString().replace('.', ','),
        });

        this.logger.log(
            `[${sessionId}] Feedback: ${feedbackValue === 1 ? '+' : '-'} | Quality: ${qualityLevel}`,
        );
    }

    async list(page: number, limit: number) {
        return this.feedbackRepository.list({ page, limit });
    }

    async getStats() {
        return this.feedbackRepository.getStats();
    }

    private validateMetadata(metadata: FeedbackInput['metadata']): boolean {
        return !!(metadata.platform && metadata.userId);
    }

    private calculateQualityScore(
        metadata: FeedbackInput['metadata'],
        feedbackValue: number,
    ): number {
        let score = feedbackValue * SCORE_WEIGHTS.feedback;

        switch (metadata.confidence) {
            case AGENT_PRIORITY.HIGH:
                score += SCORE_WEIGHTS.confidence;
                break;
            case AGENT_PRIORITY.MEDIUM:
                score += SCORE_WEIGHTS.confidence * 0.6;
                break;
            case AGENT_PRIORITY.LOW:
                score += SCORE_WEIGHTS.confidence * 0.3;
                break;
        }

        const hasResults =
            (metadata.searchResultsCount && metadata.searchResultsCount > 0) ||
            (metadata.analysisResultsCount &&
                metadata.analysisResultsCount > 0);
        if (hasResults) score += SCORE_WEIGHTS.hasResults;

        if (metadata.processingTimeMs) {
            if (metadata.processingTimeMs < RESPONSE_TIME_FAST_MS)
                score += SCORE_WEIGHTS.fastResponse;
            else if (metadata.processingTimeMs < RESPONSE_TIME_MODERATE_MS)
                score += SCORE_WEIGHTS.moderateResponse;
        }

        return Math.round(score * 10) / 10;
    }

    private formatProcessingTime(timeMs: number | undefined): string {
        if (!timeMs) return '0';
        return (timeMs / 1000).toFixed(2).replace('.', ',');
    }

    private getQualityLevel(score: number): string {
        if (score >= QUALITY_THRESHOLDS.excellent) return 'excellent';
        if (score >= QUALITY_THRESHOLDS.good) return 'good';
        if (score >= QUALITY_THRESHOLDS.fair) return 'fair';
        return 'poor';
    }
}
