import { AgentPriority } from 'src/shared/agents';
import { MessageType } from 'src/domain/messaging/common/types';

export interface InteractionMetrics {
    processingTimeMs?: number;
    recognitionTimeMs?: number;
    confidence?: AgentPriority;
    agentsUsed?: number;
    searchResultsCount?: number;
    analysisResultsCount?: number;
    coordinatorConfidence?: number;
}

export interface InteractionMetadata extends Record<string, unknown> {
    sessionId?: string;
    platform?: string;
    userId?: string;
    timestamp?: string;
    chatId?: string;
    messageId?: string;
    inputType?: MessageType;
    locale?: string;
    responseTimestamp?: string;
    confidence?: AgentPriority;
    agentsUsed?: number;
    processingTimeMs?: number;
    recognitionTimeMs?: number;
    recognitionTime?: number;
    searchResultsCount?: number;
    analysisResultsCount?: number;
    coordinatorConfidence?: number;
    hasUrl?: boolean;
    edited?: boolean;
    editTimestamp?: string;
    triggeredBy?: string;
    quickReplyIntent?: string;
    quickReplyPayload?: Record<string, unknown>;
    socketId?: string;
    fileSize?: number;
    mimeType?: string;
    fileExtension?: string;
    fileName?: string;
    audioDurationMs?: number;
    extras?: Record<string, unknown>;
}

export interface AiProcessingMetadata extends InteractionMetadata {
    executionTime?: number;
    coordinatorTime?: number;
    searchTime?: number;
    analyticsTime?: number;
    actionTime?: number;
    responseTime?: number;
    actionsExecuted?: number;
    fastPath?: boolean;
    shouldClarify?: boolean;
    llmCalls?: number;
    apiCalls?: number;
    dbQueries?: number;
}
