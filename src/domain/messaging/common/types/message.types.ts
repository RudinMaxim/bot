import { QuickReply } from 'src/domain/ai/agents';
import {
    InteractionMetadata,
    InteractionMetrics,
} from 'src/shared/types/interaction.types';

export const MessageType = {
    TEXT: 'text',
    VOICE: 'voice',
    AUDIO: 'audio',
    COMMAND: 'command',
    IMAGE: 'image',
    DOCUMENT: 'document',
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export const MessageStatus = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    FAILED: 'failed',
} as const;

export type MessageStatus = (typeof MessageStatus)[keyof typeof MessageStatus];

export type MessageMetrics = InteractionMetrics;

export interface MessageAudioPayload {
    base64: string;
    mimeType: string;
    durationMs: number;
    fileName?: string;
    size?: number;
}

export interface MessageMetadata extends InteractionMetadata {
    chatId: string;
    messageId: string;
    inputType: MessageType;
    sessionId: string;
    platform: string;
    userId: string;
    timestamp: string;
    locale?: string;
}

export interface IncomingMessage {
    readonly messageId: string;
    readonly chatId: string;
    readonly userId: string;
    readonly type: MessageType;
    readonly content: string;
    readonly rawContent?: Buffer;
    readonly timestamp: Date;
    readonly quickReplies?: string[];
    readonly metadata?: Partial<MessageMetadata>;
}

export interface OutgoingMessage {
    readonly chatId: string;
    readonly content?: string;
    readonly parseMode?: 'Markdown' | 'HTML' | 'None';
    readonly replyToMessageId?: string;
    readonly keyboard?: Array<string | QuickReply>;
    readonly audio?: MessageAudioPayload;
}

export interface ProcessedMessage {
    originalMessage: IncomingMessage;
    response: string;
    status: MessageStatus;
    metrics?: MessageMetrics;
    quickReplies?: QuickReply[];
    error?: string;
}

export interface FeedbackCommand {
    readonly chatId: string;
    readonly messageId: string;
    readonly key: string;
    readonly feedbackValue: number;
}

export interface FeedbackByKeyRequest {
    readonly key: string;
    readonly feedbackValue: number;
}

export type FeedbackByKeyResult = 'saved' | 'invalid_key' | 'not_found';
