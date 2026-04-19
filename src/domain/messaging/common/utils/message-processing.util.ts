import { ResponseAgentOutput } from 'src/domain/ai/agents';
import {
    MessageMetadata,
    ResolvedAiMessageData,
    QuickReplySource,
} from '../types';
import { QuickReply } from 'src/domain/ai/agents';

export function resolveAiMessageData(
    data: ResponseAgentOutput,
    fallbackResponse: string,
): ResolvedAiMessageData {
    const quickReplySource =
        data.quickReplies && data.quickReplies.length > 0
            ? data.quickReplies
            : (data.metadata?.quickReplies ?? []);
    return {
        response: data.response || fallbackResponse,
        quickReplies: extractQuickReplies(quickReplySource),
        confidence: data.confidence,
        agentsUsed: data.metadata?.agentsProcessed,
        searchResultsCount: data.metadata?.searchResultsCount,
        analysisResultsCount: data.metadata?.analysisResultsCount,
        coordinatorConfidence: data.metadata?.coordinatorConfidence,
        hasUrl: data.metadata?.hasUrl,
    };
}

export function extractRecognitionTimeMs(
    metadata?: Partial<MessageMetadata>,
): number | undefined {
    if (typeof metadata?.recognitionTimeMs === 'number') {
        return metadata.recognitionTimeMs;
    }

    return typeof metadata?.recognitionTime === 'number'
        ? metadata.recognitionTime
        : undefined;
}

function extractQuickReplyKeys(replies: QuickReplySource): string[] {
    return extractQuickReplies(replies).map((reply) => reply.text);
}

function extractQuickReplies(replies: QuickReplySource): QuickReply[] {
    if (!Array.isArray(replies)) {
        return [];
    }

    return replies
        .map((reply) => normalizeQuickReply(reply))
        .filter((reply): reply is QuickReply => reply !== undefined)
        .slice(0, 3);
}

function normalizeQuickReply(
    reply: string | QuickReply | { text?: string },
): QuickReply | undefined {
    const text = (typeof reply === 'string' ? reply : reply?.text)?.trim();
    if (!text) {
        return undefined;
    }

    if (typeof reply === 'string') {
        return {
            text,
            intent: 'continue_search',
            priority: 0.5,
        };
    }

    const richReply = reply as Partial<QuickReply>;
    const payload =
        richReply.payload &&
        typeof richReply.payload === 'object' &&
        !Array.isArray(richReply.payload)
            ? richReply.payload
            : undefined;

    return {
        text,
        intent:
            typeof richReply.intent === 'string'
                ? richReply.intent
                : 'continue_search',
        priority:
            typeof richReply.priority === 'number' ? richReply.priority : 0.5,
        ...(payload ? { payload } : {}),
    };
}

