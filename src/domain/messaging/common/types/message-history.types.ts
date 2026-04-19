import { MessageAudioPayload, MessageType } from './message.types';

export interface QuickReplyHistoryItem {
    text: string;
    intent?: string;
    priority?: number;
    payload?: Record<string, unknown>;
}

export interface MessageHistoryItem {
    messageId?: string;
    content?: string;
    timestamp?: string | number | Date;
    type?: MessageType;
    quickReplies?: Array<string | QuickReplyHistoryItem>;
    selectedQuickReply?: string | QuickReplyHistoryItem;
    audio?: MessageAudioPayload;
    feedbackValue?: number;
    feedbackTimestamp?: string | number | Date;
}
