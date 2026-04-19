import { IncomingMessage, MessageMetadata } from '../types';

type UnknownRecord = Record<string, unknown>;

export function buildCanonicalMetadata(
    message: IncomingMessage,
    metadata: Partial<MessageMetadata> = {},
    platformFallback = 'unknown',
): MessageMetadata {
    const incomingMetadata = message.metadata ?? {};

    return sanitizeMessageMetadata({
        ...incomingMetadata,
        ...metadata,
        sessionId: message.chatId,
        chatId: message.chatId,
        platform:
            pickNonEmptyString(incomingMetadata.platform) ??
            pickNonEmptyString(metadata.platform) ??
            platformFallback,
        userId: message.userId,
        messageId: message.messageId,
        inputType: message.type,
        timestamp: message.timestamp.toISOString(),
    });
}

export function sanitizeMessageMetadata(
    metadata: Partial<MessageMetadata>,
): MessageMetadata {
    const cleaned = compactRecord(metadata);
    const extras = sanitizeExtras(cleaned.extras);

    if (extras) {
        cleaned.extras = extras;
    } else {
        delete cleaned.extras;
    }

    return cleaned as MessageMetadata;
}

function sanitizeExtras(extras: unknown): UnknownRecord | undefined {
    if (!isRecord(extras)) {
        return undefined;
    }

    const compacted = compactRecord(extras);
    return Object.keys(compacted).length > 0 ? compacted : undefined;
}

function compactRecord<T extends UnknownRecord>(value: T): T {
    return Object.fromEntries(
        Object.entries(value).filter(
            ([, fieldValue]) => fieldValue !== undefined,
        ),
    ) as T;
}

function pickNonEmptyString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : undefined;
}

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
