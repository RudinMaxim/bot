import { QuickReply } from 'src/domain/ai/agents';
import { AgentPriority } from 'src/shared/agents';

export interface ResolvedAiMessageData {
    response: string;
    quickReplies: QuickReply[];
    confidence?: AgentPriority;
    agentsUsed?: number;
    searchResultsCount?: number;
    analysisResultsCount?: number;
    coordinatorConfidence?: number;
    hasUrl?: boolean;
}

export type QuickReplySource = Array<string | QuickReply | { text?: string }>;

export const MessageCommand = {
    HELP: '/help',
    CLEAR: '/clear',
    STOP: '/stop',
    CANCEL: '/cancel',
} as const;

export type MessageCommand =
    (typeof MessageCommand)[keyof typeof MessageCommand];
