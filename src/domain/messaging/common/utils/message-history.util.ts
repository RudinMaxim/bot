import { CachedMessageData, MessageHistoryItem, MessageType } from '../types';

export function buildMessageHistory(
    messages: CachedMessageData[],
    chatId: string,
): MessageHistoryItem[] {
    const history: MessageHistoryItem[] = [];
    const seen = new Set<string>();

    for (const cachedMessage of messages) {
        const baseId =
            cachedMessage.metadata.messageId ||
            `${chatId}-${cachedMessage.metadata.timestamp}`;

        const userMessage: MessageHistoryItem = {
            messageId: baseId,
            content: cachedMessage.request,
            timestamp: cachedMessage.metadata.timestamp,
            type: cachedMessage.metadata.inputType || MessageType.TEXT,
        };

        const userKey = `${userMessage.messageId}:user`;
        if (!seen.has(userKey)) {
            history.push(userMessage);
            seen.add(userKey);
        }

        if (!cachedMessage.response) {
            continue;
        }

        const assistantMessageId = `${baseId}:assistant`;
        const assistantKey = `${assistantMessageId}:assistant`;
        if (seen.has(assistantKey)) {
            continue;
        }

        history.push({
            messageId: assistantMessageId,
            content: cachedMessage.response,
            timestamp:
                cachedMessage.metadata.responseTimestamp ||
                cachedMessage.metadata.timestamp,
            type: MessageType.TEXT,
            quickReplies: cachedMessage.quickReplies,
            feedbackValue: cachedMessage.feedbackValue,
            feedbackTimestamp: cachedMessage.feedbackTimestamp,
        });
        seen.add(assistantKey);
    }

    return history;
}
