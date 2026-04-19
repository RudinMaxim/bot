import { AgentPriority } from 'src/shared/agents';

export interface FeedbackMetadata {
    timestamp: string;
    sessionId: string;
    platform: string;
    userId?: string | number;
    confidence?: AgentPriority;
    agentsUsed?: number;
    processingTimeMs?: number;
    searchResultsCount?: number;
    analysisResultsCount?: number;
    hasUrl?: boolean;
    inputType?: string;
    recognitionTime?: number;
}

export interface FeedbackStats {
    totalFeedback: number;
    positiveRate: number;
    avgQualityScore: number;
    avgProcessingTime: number;
}

export interface FeedbackRow {
    timestamp: string;
    sessionId: string;
    platform: string;
    userId: string | number;
    /**
     * Truncated user request (≤240 chars). Roadmap §5: full text is no
     * longer stored. Use `requestFingerprint` to group "same prompt"
     * rows in admin reports.
     */
    requestText: string;
    /** Truncated bot response (≤240 chars). See `requestText`. */
    responseText: string;
    /** sha256-prefix of the original (untruncated) request. Nullable for legacy rows. */
    requestFingerprint?: string | null;
    /** Original request length in characters. Nullable for legacy rows. */
    requestLength?: number | null;
    /** sha256-prefix of the original (untruncated) response. Nullable for legacy rows. */
    responseFingerprint?: string | null;
    /** Original response length in characters. Nullable for legacy rows. */
    responseLength?: number | null;
    feedbackValue: number;
    confidence: string;
    agentsUsed: number;
    processingTimeSec: string;
    searchResultsCount: number;
    analysisResultsCount: number;
    hasUrl: string;
    qualityScore: string;
}

export interface FeedbackInput {
    sessionId: string;
    requestText: string;
    responseText: string;
    feedbackValue: number;
    metadata: {
        timestamp: string;
        platform?: string;
        userId?: string | number;
        confidence?: AgentPriority;
        agentsUsed?: number;
        processingTimeMs?: number;
        searchResultsCount?: number;
        analysisResultsCount?: number;
        hasUrl?: boolean;
        [key: string]: unknown;
    };
}
