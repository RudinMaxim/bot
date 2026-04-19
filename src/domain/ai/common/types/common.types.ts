import { AgentPriority, IProcessingMetrics } from 'src/shared/agents';
import { AiProcessingMetadata } from 'src/shared/types/interaction.types';
import { SessionContext, QuickReplyHistoryEntry } from './context.types';
import { SearchAgentResponse } from '../../agents/search/common/types/search.types';

export interface BaseMetadata {
    timestamp?: string;
    originalLength?: number;
    cleanedLength?: number;
    originalInput?: string;
}

export interface ProcessResult<T> {
    readonly success: boolean;
    readonly data?: T;
    readonly error?: string;
    readonly sessionId: string;
    readonly timestamp: string;
    readonly processingTimeMs?: number;
    readonly metrics?: ProcessingMetrics;
    readonly contextUpdate?: SessionContext;
    readonly metadata?: PipelineMetadata;
}

export interface BatchProcessOptions {
    concurrency?: number;
    stopOnFirstError?: boolean;
    timeout?: number;
}

export interface BatchResult<T> {
    results: ProcessResult<T>[];
    summary: {
        total: number;
        successful: number;
        failed: number;
        processingTimeMs: number;
    };
}

export interface FastPathResult {
    shouldUseFastPath: boolean;
    score: number;
    reason: string;
    contextOverride?: string;
    contextSource?: string;
}

export interface ProcessingMetrics extends IProcessingMetrics {
    // Timing
    coordinatorTime?: number;
    searchTime?: number;
    analyticsTime?: number;
    actionTime?: number;
    responseTime?: number;

    // Agent execution
    agentsInvoked: number;
    agentsFailed: number;

    // Data flow
    searchResultsCount: number;
    analysisResultsCount: number;
    actionsExecuted: number;

    // Quality indicators
    coordinatorConfidence: number;
    finalConfidence: AgentPriority;

    // Path taken
    fastPathUsed: boolean;
    clarificationRequired: boolean;

    // External calls
    llmCalls: number;
    apiCalls: number;
    dbQueries: number;
    retryCount?: number;
    searchAgentUsed?: boolean;
    searchDocumentsCount?: number;
    fallbackUsed?: boolean;
    fallbackReasons?: string[];

}

export interface PipelineExtras extends Record<string, unknown> {
    contactFormRequired?: boolean;
    contactFormId?: string;
}

export interface PipelineMetadata extends BaseMetadata, AiProcessingMetadata {
    sessionContext?: SessionContext;
    conversationContext?: string;
    agentsProcessed?: number;
    agentsFailed?: number;
    quickRepliesHistory?: QuickReplyHistoryEntry[];
    abortSignal?: AbortSignal;
    clarificationQuestions?: string[];
    readinessReason?: string;
    /** Pre-resolved locale — skips the async ensureLocale() IO in Response Agent. */
    resolvedLocale?: string;
    extras?: PipelineExtras;
    previousResults?: {
        confidence?: string | number;
        agentsUsed?: number;
        [key: string]: unknown;
    };
}

export type AgentResultUnion = SearchAgentResponse;
