import { Injectable, Logger } from '@nestjs/common';
import { AiService } from 'src/domain/ai/services/ai.service';
import {
    buildCanonicalMetadata,
    buildMessageHistory,
    extractRecognitionTimeMs,
    normalizeQuickReplyInput,
    resolveAiMessageData,
} from '../common/utils';
import { MessageCacheRepository } from '../repository';
import { buildCacheKey } from '../../../shared/utils/interaction-key.util';
import { resolveLocale, t } from '../../../shared/utils/texts';
import {
    FeedbackByKeyRequest,
    FeedbackByKeyResult,
    FeedbackCommand,
    IMessageHandler,
    IncomingMessage,
    CachedMessageData,
    MessageCommand,
    MessageHistoryItem,
    MessageType,
    MessageStatus,
    ProcessedMessage,
    ResolvedAiMessageData,
} from '../common/types';
import { InteractionMetrics } from 'src/shared/types/interaction.types';
import type { PipelineCallbacks } from 'src/domain/ai/common/types';

type FeedbackTarget = {
    cacheKey: string;
    cachedMessage: CachedMessageData;
    viaAlias: boolean;
};

@Injectable()
export class MessageService implements IMessageHandler {
    private readonly logger = new Logger(MessageService.name);

    constructor(
        private readonly aiService: AiService,
        private readonly messageCacheRepo: MessageCacheRepository,
    ) {}

    async handleMessage(
        message: IncomingMessage,
        callbacks?: PipelineCallbacks,
    ): Promise<ProcessedMessage> {
        const startTime = Date.now();
        const sessionId = this.buildSessionId(message);
        const locale = resolveLocale(message.metadata?.locale);

        try {
            this.logIncomingMessage(sessionId, message);
            const normalizedMessage = this.normalizeQuickReplyMessage(
                message,
                locale,
            );

            const aiResult = await this.aiService.processMessage(
                sessionId,
                normalizedMessage.content,
                buildCanonicalMetadata(normalizedMessage),
                callbacks,
            );

            if (this.aiService.wasRunCancelled(sessionId, message.messageId)) {
                return this.createCancelledMessage(
                    message,
                    Date.now() - startTime,
                );
            }

            if (!aiResult.success || !aiResult.data) {
                return this.createFailedFromAiResult(
                    message,
                    aiResult.error,
                    locale,
                    Date.now() - startTime,
                );
            }

            const resolvedData = resolveAiMessageData(
                aiResult.data,
                t('system.messaging.fallbackResponse', undefined, locale),
            );
            const processingTimeMs = aiResult.processingTimeMs;

            await this.saveMessageToCache(
                normalizedMessage,
                sessionId,
                resolvedData,
                processingTimeMs,
            );

            return this.createCompletedMessage(
                message,
                resolvedData,
                processingTimeMs ?? Date.now() - startTime,
                aiResult.metrics,
            );
        } catch (error) {
            const errorMessage = this.extractErrorMessage(error, locale);
            this.logger.error(
                `[${sessionId}] Failed to process message: ${errorMessage}`,
                error,
            );
            return this.createFailedMessage(
                message,
                errorMessage,
                Date.now() - startTime,
            );
        }
    }

    async handleCommand(
        message: IncomingMessage,
        command: string,
    ): Promise<ProcessedMessage> {
        const sessionId = this.buildSessionId(message);
        const locale = resolveLocale(message.metadata?.locale);
        const normalizedCommand = this.normalizeCommand(command);

        this.logger.log(
            `[${sessionId}] Processing command: ${normalizedCommand}`,
        );

        let response = t(
            'system.messaging.commands.unknown',
            undefined,
            locale,
        );

        if (normalizedCommand === MessageCommand.HELP) {
            response = this.getHelpMessage(locale);
        }

        if (normalizedCommand === MessageCommand.CLEAR) {
            response = await this.handleClearCommand(sessionId, locale);
        }

        if (
            normalizedCommand === MessageCommand.STOP ||
            normalizedCommand === MessageCommand.CANCEL
        ) {
            const cancelled = this.aiService.cancelProcessing(
                sessionId,
                'user_cancelled',
            );
            response = cancelled
                ? t('system.messaging.commands.stop.stopped', undefined, locale)
                : t(
                      'system.messaging.commands.stop.noActive',
                      undefined,
                      locale,
                  );
        }

        return {
            originalMessage: message,
            response,
            status: MessageStatus.COMPLETED,
            metrics: { processingTimeMs: 0 },
        };
    }

    async handleFeedbackByKey({
        key,
        feedbackValue,
    }: FeedbackByKeyRequest): Promise<FeedbackByKeyResult> {
        const parsed = this.parseFeedbackKey(key);
        if (!parsed) {
            return 'invalid_key';
        }

        const handled = await this.handleFeedback({
            chatId: parsed.chatId,
            messageId: parsed.messageId,
            key,
            feedbackValue,
        });

        return handled ? 'saved' : 'not_found';
    }

    async handleFeedback({
        chatId,
        messageId,
        key,
        feedbackValue,
    }: FeedbackCommand): Promise<boolean> {
        const expectedKey = buildCacheKey(chatId, messageId);
        if (key !== expectedKey) {
            this.logger.warn(
                `[${chatId}] Feedback key mismatch: expected ${expectedKey}, got ${key}`,
            );
            return false;
        }

        const feedbackTarget = await this.resolveFeedbackTarget(
            chatId,
            messageId,
            key,
        );
        if (!feedbackTarget) {
            this.logger.warn(
                `[${chatId}] Cached message not found for feedback`,
            );
            return false;
        }

        const { cacheKey, cachedMessage, viaAlias } = feedbackTarget;

        if (cachedMessage.metadata.chatId !== chatId) {
            this.logger.warn(
                `[${chatId}] Feedback metadata mismatch for key ${key}`,
            );
            return false;
        }

        if (!viaAlias && cachedMessage.metadata.messageId !== messageId) {
            this.logger.warn(
                `[${chatId}] Feedback metadata mismatch for key ${key}`,
            );
            return false;
        }

        const existingFeedback = cachedMessage.feedbackValue;
        if (existingFeedback === feedbackValue) {
            this.logger.log(
                `[${chatId}] Feedback already recorded for ${cacheKey}, skip`,
            );
            return true;
        }

        this.logger.log(
            `[${chatId}] Feedback updated for ${cacheKey}: ${existingFeedback} -> ${feedbackValue}`,
        );

        this.logger.log(
            `[${chatId}] User feedback (${messageId}): ${feedbackValue === 1 ? 'positive' : 'negative'}`,
        );

        await this.aiService.logFeedback(
            cachedMessage.request,
            cachedMessage.response,
            feedbackValue,
            cachedMessage.metadata,
        );

        await this.messageCacheRepo.set(cacheKey, {
            ...cachedMessage,
            feedbackValue,
            feedbackTimestamp: new Date().toISOString(),
        });

        return true;
    }

    async saveResponseFeedbackAlias(
        chatId: string,
        requestMessageId: string,
        responseMessageId: string,
    ): Promise<void> {
        if (!chatId || !requestMessageId || !responseMessageId) {
            return;
        }

        await this.messageCacheRepo.setFeedbackAlias(
            chatId,
            responseMessageId,
            buildCacheKey(chatId, requestMessageId),
        );
    }

    async getMessageHistory(
        chatId: string,
        limit?: number,
    ): Promise<MessageHistoryItem[]> {
        try {
            const messages = await this.messageCacheRepo.getMessagesByChat(
                chatId,
                limit,
            );
            return buildMessageHistory(messages, chatId);
        } catch (error) {
            this.logger.error(
                `Failed to get message history for chat ${chatId}:`,
                error,
            );
            return [];
        }
    }

    async clearSessionAndHistory(
        sessionId: string,
    ): Promise<{ clearedMessages: number }> {
        try {
            this.logger.log(
                `[${sessionId}] Clearing session and message history`,
            );

            const [, clearedMessages] = await Promise.all([
                this.aiService.clearSession(sessionId),
                this.messageCacheRepo.deleteByChatId(sessionId),
            ]);

            this.logger.log(
                `[${sessionId}] History cleared, removed messages: ${clearedMessages}`,
            );

            return { clearedMessages };
        } catch (error) {
            this.logger.error(`[${sessionId}] Failed to clear session:`, error);
            throw new Error('Failed to clear session', {
                cause: error instanceof Error ? error : undefined,
            });
        }
    }

    async handleClearCommand(
        sessionId: string,
        locale: ReturnType<typeof resolveLocale> = resolveLocale(),
    ): Promise<string> {
        try {
            const { clearedMessages } =
                await this.clearSessionAndHistory(sessionId);

            const textDetails = t(
                'content.messaging.clear.details',
                { count: clearedMessages },
                locale,
            );

            this.logger.log(`[${sessionId}] Session context cleared by user`);

            return t(
                'content.messaging.clear.success',
                { details: clearedMessages > 0 ? textDetails : '' },
                locale,
            );
        } catch (error) {
            this.logger.error(`Failed to clear session ${sessionId}:`, error);
            return t('system.messaging.errors.clearFailed', undefined, locale);
        }
    }

    private createFailedFromAiResult(
        message: IncomingMessage,
        error: string | undefined,
        locale: ReturnType<typeof resolveLocale>,
        processingTimeMs: number,
    ): ProcessedMessage {
        if (error === 'cancelled') {
            return this.createCancelledMessage(message, processingTimeMs);
        }

        return this.createFailedMessage(
            message,
            error ||
                t(
                    'system.messaging.errors.processingDefault',
                    undefined,
                    locale,
                ),
            processingTimeMs,
        );
    }

    private async saveMessageToCache(
        message: IncomingMessage,
        sessionId: string,
        data: ResolvedAiMessageData,
        processingTimeMs?: number,
    ): Promise<void> {
        const cacheKey = buildCacheKey(message.chatId, message.messageId);

        await this.messageCacheRepo.set(cacheKey, {
            request: message.content,
            response: data.response,
            quickReplies: data.quickReplies,
            metadata: buildCanonicalMetadata(
                message,
                {
                    sessionId,
                    confidence: data.confidence,
                    agentsUsed: data.agentsUsed,
                    processingTimeMs,
                    recognitionTimeMs: extractRecognitionTimeMs(
                        message.metadata,
                    ),
                    searchResultsCount: data.searchResultsCount,
                    analysisResultsCount: data.analysisResultsCount,
                    coordinatorConfidence: data.coordinatorConfidence,
                    hasUrl: data.hasUrl,
                },
                'unknown',
            ),
        });
    }

    private createCompletedMessage(
        message: IncomingMessage,
        data: ResolvedAiMessageData,
        processingTimeMs: number,
        pipelineMetrics?: InteractionMetrics,
    ): ProcessedMessage {
        return {
            originalMessage: message,
            response: data.response,
            status: MessageStatus.COMPLETED,
            quickReplies: data.quickReplies,
            metrics: {
                processingTimeMs,
                confidence: data.confidence,
                agentsUsed: data.agentsUsed,
                searchResultsCount: data.searchResultsCount,
                analysisResultsCount: data.analysisResultsCount,
                ...(pipelineMetrics ?? {}),
            },
        };
    }

    private createFailedMessage(
        message: IncomingMessage,
        error: string,
        processingTimeMs: number,
    ): ProcessedMessage {
        const locale = resolveLocale(message.metadata?.locale);

        return {
            originalMessage: message,
            response: t('system.messaging.errors.failed', { error }, locale),
            status: MessageStatus.FAILED,
            error,
            metrics: { processingTimeMs },
        };
    }

    private createCancelledMessage(
        message: IncomingMessage,
        processingTimeMs: number,
    ): ProcessedMessage {
        return {
            originalMessage: message,
            response: '',
            status: MessageStatus.CANCELLED,
            error: 'cancelled',
            metrics: { processingTimeMs },
        };
    }

    wasMessageCancelled(message: IncomingMessage): boolean {
        return this.aiService.wasRunCancelled(
            message.chatId,
            message.messageId,
        );
    }

    private logIncomingMessage(
        sessionId: string,
        message: IncomingMessage,
    ): void {
        this.logger.log(
            `[${sessionId}] Processing ${message.type} message from ${message.userId} | platform=${message.metadata?.platform ?? 'unknown'}`,
        );
    }

    private buildSessionId(message: IncomingMessage): string {
        return message.chatId;
    }

    private normalizeCommand(command: string): string {
        return command.toLowerCase().split(' ')[0];
    }

    private extractErrorMessage(
        error: unknown,
        locale: ReturnType<typeof resolveLocale>,
    ): string {
        if (error instanceof Error) {
            return error.message;
        }

        return t('system.messaging.errors.unknownError', undefined, locale);
    }

    private getHelpMessage(locale: ReturnType<typeof resolveLocale>): string {
        return t('content.messaging.help', undefined, locale);
    }

    private parseFeedbackKey(
        key: string,
    ): { chatId: string; messageId: string } | null {
        const separatorIndex = key.indexOf(':');
        if (separatorIndex <= 0 || separatorIndex === key.length - 1) {
            return null;
        }

        const chatId = key.slice(0, separatorIndex).trim();
        const messageId = key.slice(separatorIndex + 1).trim();
        if (!chatId || !messageId) {
            return null;
        }

        return { chatId, messageId };
    }

    private normalizeQuickReplyMessage(
        message: IncomingMessage,
        locale: ReturnType<typeof resolveLocale>,
    ): IncomingMessage {
        if (message.type !== MessageType.TEXT) {
            return message;
        }

        const normalized = normalizeQuickReplyInput(message.content, locale);
        if (normalized.content === message.content) {
            return message;
        }

        return {
            ...message,
            content: normalized.content,
            metadata: {
                ...(message.metadata ?? {}),
                quickReplyIntent:
                    normalized.intent ?? message.metadata?.quickReplyIntent,
            },
        };
    }

    private async resolveFeedbackTarget(
        chatId: string,
        messageId: string,
        defaultCacheKey: string,
    ): Promise<FeedbackTarget | null> {
        const directMessage = await this.messageCacheRepo.get(defaultCacheKey);
        if (directMessage) {
            return {
                cacheKey: defaultCacheKey,
                cachedMessage: directMessage,
                viaAlias: false,
            };
        }

        const aliasedCacheKey =
            await this.messageCacheRepo.getFeedbackSourceKey(chatId, messageId);
        if (!aliasedCacheKey) {
            return null;
        }

        const aliasedMessage = await this.messageCacheRepo.get(aliasedCacheKey);
        if (!aliasedMessage) {
            return null;
        }

        return {
            cacheKey: aliasedCacheKey,
            cachedMessage: aliasedMessage,
            viaAlias: true,
        };
    }
}
