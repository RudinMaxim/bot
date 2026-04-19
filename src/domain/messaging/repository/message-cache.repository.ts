import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/infrastructure/redis/redis.config';
import { CachedMessageData, MessageType } from '../common/types';

@Injectable()
export class MessageCacheRepository {
    private readonly logger = new Logger(MessageCacheRepository.name);
    private readonly CACHE_KEY_PREFIX = 'messaging:cache:';
    private readonly FEEDBACK_ALIAS_KEY_PREFIX = 'messaging:feedback-alias:';
    private readonly VERSION_KEY_PREFIX = 'v1:';
    private readonly CACHE_TTL = 3600; // 1 hour

    constructor(private readonly redisService: RedisService) {}

    async get(cacheKey: string): Promise<CachedMessageData | null> {
        try {
            const key = `${this.CACHE_KEY_PREFIX}${this.VERSION_KEY_PREFIX}${cacheKey}`;
            const cached = await this.redisService.get<string>(key);
            if (!cached) return null;
            return this.parseCachedMessage(cached);
        } catch (error) {
            this.logger.warn(
                `Failed to get cached message for ${cacheKey}:`,
                error,
            );
            return null;
        }
    }

    async set(cacheKey: string, data: CachedMessageData): Promise<void> {
        try {
            const key = this.buildStorageKey(this.CACHE_KEY_PREFIX, cacheKey);
            await this.redisService.set(
                key,
                JSON.stringify(data),
                this.CACHE_TTL,
            );
        } catch (error) {
            this.logger.error(
                `Failed to cache message for ${cacheKey}:`,
                error,
            );
        }
    }

    async delete(cacheKey: string): Promise<void> {
        try {
            const key = this.buildStorageKey(this.CACHE_KEY_PREFIX, cacheKey);
            await this.redisService.del(key);
        } catch (error) {
            this.logger.warn(
                `Failed to delete cached message for ${cacheKey}:`,
                error,
            );
        }
    }

    async setFeedbackAlias(
        chatId: string,
        responseMessageId: string,
        sourceCacheKey: string,
    ): Promise<void> {
        try {
            const aliasKey = this.buildFeedbackAliasKey(
                chatId,
                responseMessageId,
            );
            await this.redisService.set(
                aliasKey,
                sourceCacheKey,
                this.CACHE_TTL,
            );
        } catch (error) {
            this.logger.warn(
                `Failed to cache feedback alias for ${chatId}:${responseMessageId}:`,
                error,
            );
        }
    }

    async getFeedbackSourceKey(
        chatId: string,
        responseMessageId: string,
    ): Promise<string | null> {
        try {
            return (
                (await this.redisService.get<string>(
                    this.buildFeedbackAliasKey(chatId, responseMessageId),
                )) ?? null
            );
        } catch (error) {
            this.logger.warn(
                `Failed to resolve feedback alias for ${chatId}:${responseMessageId}:`,
                error,
            );
            return null;
        }
    }

    async getMessagesByChat(
        chatId: string,
        limit?: number,
    ): Promise<CachedMessageData[]> {
        try {
            const pattern = `${this.CACHE_KEY_PREFIX}${this.VERSION_KEY_PREFIX}${chatId}:*`;
            const keys = await this.scanKeys(pattern);

            if (keys.length === 0) {
                return [];
            }

            const payloads = await this.redisService.mget(keys);
            const messages: CachedMessageData[] = [];

            payloads.forEach((payload) => {
                if (!payload) return;
                const parsed = this.parseCachedMessage(payload);
                if (parsed) messages.push(parsed);
            });

            const sorted = messages.sort((a, b) => {
                const timestampA = new Date(a.metadata.timestamp).getTime();
                const timestampB = new Date(b.metadata.timestamp).getTime();
                return timestampB - timestampA;
            });

            return typeof limit === 'number' ? sorted.slice(0, limit) : sorted;
        } catch (error) {
            this.logger.error(
                `Failed to get messages for chat ${chatId}:`,
                error,
            );
            return [];
        }
    }

    async deleteByChatId(chatId: string): Promise<number> {
        try {
            const cachePattern = `${this.CACHE_KEY_PREFIX}${this.VERSION_KEY_PREFIX}${chatId}:*`;
            const aliasPattern = `${this.FEEDBACK_ALIAS_KEY_PREFIX}${this.VERSION_KEY_PREFIX}${chatId}:*`;
            const [cacheKeys, aliasKeys] = await Promise.all([
                this.scanKeys(cachePattern),
                this.scanKeys(aliasPattern),
            ]);
            const keys = [...cacheKeys, ...aliasKeys];

            if (keys.length === 0) {
                return 0;
            }

            const results = await Promise.all(
                keys.map((key) => this.redisService.del(key)),
            );

            return results.reduce((total, deleted) => total + deleted, 0);
        } catch (error) {
            this.logger.error(
                `Failed to clear messages for chat ${chatId}:`,
                error,
            );
            throw new Error('Failed to clear message history');
        }
    }

    async deleteByMessageId(chatId: string, messageId: string): Promise<void> {
        try {
            const pattern = `${this.CACHE_KEY_PREFIX}${this.VERSION_KEY_PREFIX}${chatId}:*`;
            const keys = await this.scanKeys(pattern);
            await this.deleteByMetaKey(keys, (message) =>
                message?.metadata.messageId === messageId
                    ? this.keyWithoutPrefix(message)
                    : null,
            );
        } catch (error) {
            this.logger.error(`Failed to delete message ${messageId}:`, error);
            throw new Error('Failed to delete message');
        }
    }

    async getByMessageId(
        chatId: string,
        messageId: string,
    ): Promise<CachedMessageData | null> {
        try {
            const pattern = `${this.CACHE_KEY_PREFIX}${this.VERSION_KEY_PREFIX}${chatId}:*`;
            const keys = await this.scanKeys(pattern);
            const payloads = keys.length
                ? await this.redisService.mget(keys)
                : [];

            for (const payload of payloads) {
                if (!payload) continue;
                const message = this.parseCachedMessage(payload);
                if (message?.metadata.messageId === messageId) {
                    return message;
                }
            }

            return null;
        } catch (error) {
            this.logger.error(`Failed to find message ${messageId}:`, error);
            return null;
        }
    }

    async update(
        chatId: string,
        messageId: string,
        updatedData: CachedMessageData,
    ): Promise<void> {
        try {
            const pattern = `${this.CACHE_KEY_PREFIX}${this.VERSION_KEY_PREFIX}${chatId}:*`;
            const keys = await this.scanKeys(pattern);

            for (const key of keys) {
                const payload = await this.redisService.get<string>(key);
                const message = payload
                    ? this.parseCachedMessage(payload)
                    : null;

                if (message?.metadata.messageId === messageId) {
                    await this.set(this.keyWithoutPrefix(message), updatedData);
                    break;
                }
            }
        } catch (error) {
            this.logger.error(`Failed to update message ${messageId}:`, error);
            throw new Error('Failed to update message');
        }
    }

    private keyWithoutPrefix(message: CachedMessageData): string {
        return `${message.metadata.chatId}:${message.metadata.messageId}`;
    }

    private buildStorageKey(prefix: string, cacheKey: string): string {
        return `${prefix}${this.VERSION_KEY_PREFIX}${cacheKey}`;
    }

    private buildFeedbackAliasKey(
        chatId: string,
        responseMessageId: string,
    ): string {
        return this.buildStorageKey(
            this.FEEDBACK_ALIAS_KEY_PREFIX,
            `${chatId}:${responseMessageId}`,
        );
    }

    private async deleteByMetaKey(
        keys: string[],
        matcher: (message: CachedMessageData | null) => string | null,
    ): Promise<void> {
        for (const key of keys) {
            const payload = await this.redisService.get<string>(key);
            const message = payload ? this.parseCachedMessage(payload) : null;
            const cacheKey = matcher(message);
            if (cacheKey) {
                await this.delete(cacheKey);
                break;
            }
        }
    }

    private async scanKeys(pattern: string): Promise<string[]> {
        let cursor = '0';
        const keys: string[] = [];
        const count = 100;

        do {
            const res = await this.redisService.scan(cursor, pattern, count);
            keys.push(...res.keys);
            cursor = res.cursor;
        } while (cursor !== '0');

        return keys;
    }

    private parseCachedMessage(payload: string): CachedMessageData | null {
        try {
            const parsed = JSON.parse(payload);
            if (this.isCachedMessageData(parsed)) {
                return parsed;
            }

            this.logger.warn('Cached message has invalid shape, skipping');
            return null;
        } catch (error) {
            this.logger.warn('Failed to parse cached message payload:', error);
            return null;
        }
    }

    private isCachedMessageData(value: unknown): value is CachedMessageData {
        if (!this.isRecord(value)) return false;
        if (!this.isRecord(value.metadata)) return false;

        const { request, response, metadata } = value;

        return (
            typeof request === 'string' &&
            typeof response === 'string' &&
            typeof metadata.sessionId === 'string' &&
            typeof metadata.chatId === 'string' &&
            typeof metadata.platform === 'string' &&
            typeof metadata.userId === 'string' &&
            typeof metadata.messageId === 'string' &&
            typeof metadata.timestamp === 'string' &&
            this.isMessageType(metadata.inputType)
        );
    }

    private isMessageType(value: unknown): value is MessageType {
        return Object.values(MessageType).some((type) => type === value);
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null;
    }
}
