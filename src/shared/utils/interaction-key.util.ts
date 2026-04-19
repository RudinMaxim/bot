export const CACHE_KEY_DELIMITER = ':';

export function buildCacheKey(chatId: string, messageId: string): string {
    return `${chatId}${CACHE_KEY_DELIMITER}${messageId}`;
}

export function extractChatIdFromCacheKey(cacheKey: string): string | null {
    const [chatId] = cacheKey.split(CACHE_KEY_DELIMITER);
    return chatId || null;
}
