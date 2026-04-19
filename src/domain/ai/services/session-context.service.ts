import { Injectable, Logger } from '@nestjs/common';
import { InputValidationService } from './input-validation.service';
import { resolveLocale, t } from 'src/shared/utils';
import {
    MessageHistory,
    TokenCountResult,
    SessionContactContext,
    ConversationSummary,
    SessionContext,
    QuickReplyHistoryEntry,
    Role,
    PipelineMetadata,
} from '../common/types';
import { QuickReply } from '../agents';
import { SummarizationRunnerService } from '../agents/summarization';
import { SessionContextRepository } from '../repository';
import { estimateTokens, truncateAtWord } from '../common/utils';
import { AGENT_PRIORITY } from '../common/constants';

@Injectable()
export class SessionContextService {
    private readonly logger = new Logger(SessionContextService.name);
    private readonly config = {
        ttlMs: 1000 * 60 * 60 * 24,
        maxHistoryLength: 20,
        maxContextTokens: 8000,
        summarizationTokenThreshold: 6000,
        quickRepliesHistorySize: 10,
        version: 3,
        lockTTL: 60,
    } as const;

    constructor(
        private readonly sessionContextRepo: SessionContextRepository,
        private readonly validationService: InputValidationService,
        private readonly summarizationService: SummarizationRunnerService,
    ) {}

    // ========== Публичные методы ==========

    async get(sessionId: string): Promise<SessionContext | undefined> {
        try {
            const data = await this.sessionContextRepo.get(
                sessionId,
                this.config.version,
            );
            if (!data) return undefined;

            const context = this.deserialize(data);
            if (!context) return undefined;

            if (context.version !== this.config.version) {
                this.migrateContext(context);
            }

            if (this.isExpired(context)) {
                await this.archive(sessionId, context);
                return undefined;
            }

            context.quickRepliesHistory = this.clampQuickRepliesHistory(
                context.quickRepliesHistory ?? [],
            );

            return context;
        } catch (error) {
            this.logger.error(`Failed to get session ${sessionId}:`, error);
            return undefined;
        }
    }

    async addMessage(
        sessionId: string,
        role: Role,
        content: string,
        metadata?: PipelineMetadata,
    ): Promise<void> {
        const rawLocale = this.resolveMetadataLocale(metadata);
        const resolvedLocale = resolveLocale(rawLocale);
        const validation = this.validationService.validateMessage(
            content,
            role,
            {
                maxLength: 8000,
                preserveCase: true,
                preserveFormatting: true,
                locale: rawLocale,
            },
        );

        if (!validation.isValid) {
            this.logger.warn(
                `Message validation failed for ${sessionId}: ${validation.error}`,
            );
            throw new Error(
                t(
                    'system.ai.validation.invalidMessageContent',
                    { error: validation.error },
                    resolvedLocale,
                ),
            );
        }

        let context = await this.get(sessionId);
        const isNewSession = !context;
        context = context ?? this.createEmptyContext();

        const message = this.createMessage(role, validation.cleaned, metadata);
        context.messageHistory.push(message);
        context.totalMessages++;
        context.lastActivity = Date.now();

        if (isNewSession) {
            context.summary = this.createInitialSummary(validation.cleaned);
        }

        this.rotateHistory(context);
        await this.save(sessionId, context);
    }

    async updateQuickRepliesHistory(
        sessionId: string,
        quickReplies: QuickReply[],
    ): Promise<void> {
        if (!quickReplies?.length) return;

        const context =
            (await this.get(sessionId)) ?? this.createEmptyContext();
        const now = Date.now();

        const newEntries = quickReplies.map((reply) => ({
            text: reply.text,
            intent: reply.intent,
            timestamp: now,
        }));

        const merged = [...newEntries, ...(context.quickRepliesHistory ?? [])];

        const deduped = this.clampQuickRepliesHistory(merged);

        context.quickRepliesHistory = deduped;
        context.lastActivity = now;

        await this.save(sessionId, context);
    }

    async updateContact(
        sessionId: string,
        partial: Partial<SessionContactContext>,
        locale?: string,
    ): Promise<SessionContactContext> {
        if (
            partial.clientName ||
            partial.phone ||
            partial.email ||
            partial.contactInfo
        ) {
            const validation = this.validationService.validateContactInfo(
                partial.clientName,
                partial.phone,
                partial.email,
                partial.contactInfo,
                locale,
            );

            if (!validation.isValid) {
                this.logger.warn(
                    `Contact validation failed: ${validation.errors.join(', ')}`,
                );
                throw new Error(
                    t(
                        'system.ai.validation.invalidContactData',
                        { error: validation.errors.join(', ') },
                        resolveLocale(locale),
                    ),
                );
            }
        }

        const context =
            (await this.get(sessionId)) ?? this.createEmptyContext();

        context.contact = {
            ...context.contact,
            ...partial,
            contactInfo:
                partial.contactInfo ??
                partial.phone ??
                partial.email ??
                context.contact?.contactInfo,
            updatedAt: Date.now(),
        };
        context.lastActivity = Date.now();

        await this.save(sessionId, context);
        return context.contact;
    }

    async getConversationContext(
        sessionId: string,
        preloaded?: SessionContext,
    ): Promise<string> {
        const context = preloaded ?? (await this.get(sessionId));
        if (!context) return '';

        const result = this.buildTokenCountResult(context);
        return this.buildContextString(context, result);
    }

    async getContextForModel(
        sessionId: string,
        maxTokens: number = this.config.maxContextTokens,
    ): Promise<TokenCountResult> {
        const context = await this.get(sessionId);
        if (!context) return this.emptyTokenResult();

        return this.buildTokenCountResult(context, maxTokens);
    }

    private buildTokenCountResult(
        context: SessionContext,
        maxTokens: number = this.config.maxContextTokens,
    ): TokenCountResult {
        const summaryTokens = context.summary?.tokens || 0;
        const availableTokens = maxTokens - summaryTokens - 500;

        const messagesToInclude = this.selectMessagesToInclude(
            context,
            availableTokens,
        );
        const totalTokens =
            summaryTokens + this.calculateTotalTokens(messagesToInclude);

        return {
            totalTokens,
            canFit: totalTokens <= maxTokens,
            messagesToInclude,
            summaryTokens,
        };
    }

    async clear(sessionId: string): Promise<void> {
        try {
            await this.sessionContextRepo.delete(
                sessionId,
                this.config.version,
            );
            this.logger.log(`Session ${sessionId} cleared`);
        } catch (error) {
            this.logger.error(`Failed to clear session ${sessionId}:`, error);
            throw error;
        }
    }

    async exists(sessionId: string): Promise<boolean> {
        try {
            return await this.sessionContextRepo.exists(
                sessionId,
                this.config.version,
            );
        } catch {
            return false;
        }
    }

    async triggerSummarizationIfNeeded(sessionId: string): Promise<void> {
        const context = await this.get(sessionId);
        if (!context || context.summarizationPending) return;
        if (!this.shouldTriggerSummarization(context)) return;

        context.summarizationPending = true;
        await this.save(sessionId, context);

        this.summarizationService
            .run(
                sessionId,
                () => this.get(sessionId),
                (ctx) => this.save(sessionId, ctx),
                this.config.lockTTL,
                (ctx) => this.compressHistory(ctx),
            )
            .catch((err) => {
                this.logger.error(
                    `Background summarization failed for ${sessionId}:`,
                    err,
                );
            });
    }

    // ========== Управление контекстом ==========

    private selectMessagesToInclude(
        context: SessionContext,
        availableTokens: number,
    ): MessageHistory[] {
        const messages: MessageHistory[] = [];
        let currentTokens = 0;

        for (let i = context.messageHistory.length - 1; i >= 0; i--) {
            const msg = context.messageHistory[i];
            if (currentTokens + msg.tokens <= availableTokens) {
                messages.unshift(msg);
                currentTokens += msg.tokens;
            } else {
                break;
            }
        }

        if (context.semanticIndex && availableTokens - currentTokens > 1000) {
            const importantMessages = this.getImportantMessages(
                context,
                availableTokens - currentTokens,
            );
            messages.unshift(...importantMessages);
        }

        return messages;
    }

    private getImportantMessages(
        context: SessionContext,
        maxTokens: number,
    ): MessageHistory[] {
        if (!context.semanticIndex) return [];

        const importantIds = new Set(context.semanticIndex);
        const messages: MessageHistory[] = [];
        let tokens = 0;

        for (const msg of context.messageHistory) {
            if (importantIds.has(msg.id) && tokens + msg.tokens <= maxTokens) {
                messages.push(msg);
                tokens += msg.tokens;
            }
        }

        return messages;
    }

    private shouldTriggerSummarization(context: SessionContext): boolean {
        const totalTokens = context.messageHistory.reduce(
            (sum, m) => sum + m.tokens,
            0,
        );
        return totalTokens >= this.config.summarizationTokenThreshold;
    }

    private compressHistory(context: SessionContext): void {
        const importantMessages = context.messageHistory.filter(
            (m) =>
                m.metadata?.confidence === AGENT_PRIORITY.HIGH ||
                m.metadata?.agentsUsed ||
                m.tokens > 200,
        );

        context.semanticIndex = importantMessages.map((m) => m.id);

        const keepCount = Math.floor(this.config.maxHistoryLength / 2);
        const toRemove = context.messageHistory.length - keepCount;

        if (toRemove > 0) {
            const importantIds = new Set(context.semanticIndex);
            const filtered: MessageHistory[] = [];
            let removed = 0;

            for (let i = 0; i < context.messageHistory.length; i++) {
                const msg = context.messageHistory[i];
                if (
                    importantIds.has(msg.id) ||
                    i >= context.messageHistory.length - keepCount
                ) {
                    filtered.push(msg);
                } else if (removed < toRemove) {
                    removed++;
                }
            }

            context.messageHistory = filtered;
            this.logger.log(`Compressed history: removed ${removed} messages`);
        }
    }

    private rotateHistory(context: SessionContext): void {
        if (context.messageHistory.length > this.config.maxHistoryLength) {
            context.messageHistory = context.messageHistory.slice(
                -this.config.maxHistoryLength,
            );
        }
    }

    private buildContextString(
        context: SessionContext,
        result: TokenCountResult,
    ): string {
        let str = '';

        // Cold tier: permanent facts (broadSummary)
        if (context.summary?.broadSummary) {
            str += `=== Постоянный контекст ===\n${context.summary.broadSummary}\n\n`;
        }

        // Warm tier: detailed recent summary (longTermSummary)
        if (context.summary?.longTermSummary) {
            str += `=== История разговора ===\n${context.summary.longTermSummary}\n\n`;
        }

        if (context.summary?.propertyPreferences) {
            const prefs = context.summary.propertyPreferences;
            const parts: string[] = [];
            if (prefs.type) parts.push(`тип: ${prefs.type}`);
            if (prefs.bedrooms) parts.push(`комнат: ${prefs.bedrooms}`);
            if (prefs.budgetMin || prefs.budgetMax) {
                parts.push(
                    `бюджет: ${prefs.budgetMin ?? ''}–${prefs.budgetMax ?? ''}`,
                );
            }
            if (prefs.areaMin || prefs.areaMax) {
                parts.push(
                    `площадь: ${prefs.areaMin ?? ''}–${prefs.areaMax ?? ''} м²`,
                );
            }
            if (prefs.building) parts.push(`корпус: ${prefs.building}`);
            if (parts.length) {
                str += `=== Критерии подбора ===\n${parts.join(', ')}\n\n`;
            }
        }

        if (context.summary?.rejections?.length) {
            str += `=== Отказы клиента ===\n${context.summary.rejections.join('; ')}\n\n`;
        }

        if (context.summary?.importantFacts?.length) {
            str += `=== Важные факты ===\n`;
            context.summary.importantFacts.forEach((fact, i) => {
                str += `${i + 1}. ${fact}\n`;
            });
            str += '\n';
        }

        if (context.contact && this.hasContactInfo(context.contact)) {
            str += this.formatContactInfo(context.contact);
        }

        // Hot tier: verbatim recent messages (non-summarized only)
        if (result.messagesToInclude.length > 0) {
            const verbatim = result.messagesToInclude.filter(
                (m) => !m.summarized,
            );
            const recentMessages = this.deduplicateRecentMessages(verbatim);
            if (recentMessages.length) {
                str += '=== Последние сообщения ===\n';
                recentMessages.forEach((msg) => {
                    const role = msg.role === 'user' ? 'Клиент' : 'Ассистент';
                    str += `${role}: ${msg.content}\n`;
                });
            }
        }

        str += `\n[Токены: ${result.totalTokens}/${this.config.maxContextTokens}]`;
        if (context.summarizationPending) {
            str += ` [Суммаризация в процессе...]`;
        }

        return str.trim();
    }

    private deduplicateRecentMessages(
        messages: MessageHistory[],
        limit: number = 6,
    ): MessageHistory[] {
        const seen = new Set<string>();
        const deduped: MessageHistory[] = [];

        for (const msg of messages) {
            const key = `${msg.role}:${msg.content.trim().toLowerCase()}`;
            if (seen.has(key)) continue;
            seen.add(key);
            deduped.push(msg);
        }

        if (deduped.length > limit) {
            return deduped.slice(-limit);
        }

        return deduped;
    }

    private hasContactInfo(contact: SessionContactContext): boolean {
        return !!(
            contact.clientName ||
            contact.phone ||
            contact.email ||
            contact.contactInfo ||
            contact.actionType ||
            contact.description ||
            contact.lotId ||
            contact.appointmentDate
        );
    }

    private formatContactInfo(contact: SessionContactContext): string {
        let str = '=== Контекст клиента ===\n';
        if (contact.clientName) str += `Имя: ${contact.clientName}\n`;
        if (contact.phone) str += `Телефон: ${contact.phone}\n`;
        if (contact.email) str += `Email: ${contact.email}\n`;
        if (!contact.phone && !contact.email && contact.contactInfo) {
            str += `Контакт: ${contact.contactInfo}\n`;
        }
        if (contact.actionType) str += `Тип действия: ${contact.actionType}\n`;
        if (contact.description) str += `Описание: ${contact.description}\n`;
        if (contact.lotId) str += `ID лота: ${contact.lotId}\n`;
        if (contact.appointmentDate) {
            str += `Дата: ${contact.appointmentDate}\n`;
        }
        return str + '\n';
    }

    // ========== Утилиты ==========

    private createMessage(
        role: Role,
        content: string,
        metadata?: PipelineMetadata,
    ): MessageHistory {
        return {
            id: this.generateMessageId(),
            timestamp: new Date().toISOString(),
            role,
            content,
            tokens: estimateTokens(content),
            metadata,
        };
    }

    private createInitialSummary(firstMessage: string): ConversationSummary {
        const preview = truncateAtWord(firstMessage, 100);
        return {
            shortTermSummary: preview,
            longTermSummary: `Начало диалога: "${preview}"`,
            keyTopics: [],
            importantFacts: [],
            lastUpdated: Date.now(),
            tokens: estimateTokens(preview),
        };
    }

    private isExpired(context: SessionContext): boolean {
        return (
            !!context.lastActivity &&
            Date.now() - context.lastActivity > this.config.ttlMs
        );
    }

    private calculateTotalTokens(messages: MessageHistory[]): number {
        return messages.reduce((sum, msg) => sum + msg.tokens, 0);
    }

    private generateMessageId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private createEmptyContext(): SessionContext {
        return {
            version: this.config.version,
            contact: { updatedAt: 0 },
            messageHistory: [],
            summary: this.getEmptySummary(),
            lastActivity: Date.now(),
            totalMessages: 0,
            summarizationPending: false,
            semanticIndex: [],
            quickRepliesHistory: [],
        };
    }

    private resolveMetadataLocale(
        metadata?: Record<string, unknown>,
    ): string | undefined {
        if (!metadata || typeof metadata !== 'object') return undefined;
        const candidate = (metadata as { locale?: unknown }).locale;
        return typeof candidate === 'string' ? candidate : undefined;
    }

    private getEmptySummary(): ConversationSummary {
        return {
            shortTermSummary: 'Новая сессия',
            longTermSummary: 'Диалог только начался',
            keyTopics: [],
            importantFacts: [],
            lastUpdated: Date.now(),
            tokens: 10,
        };
    }

    private emptyTokenResult(): TokenCountResult {
        return {
            totalTokens: 0,
            canFit: true,
            messagesToInclude: [],
            summaryTokens: 0,
        };
    }

    private migrateContext(context: SessionContext): void {
        if (!context.version || context.version < 1) {
            context.version = this.config.version;
            context.totalMessages = context.messageHistory.length;

            for (const msg of context.messageHistory) {
                if (!msg.tokens) {
                    msg.tokens = estimateTokens(msg.content);
                }
                if (!msg.id) {
                    msg.id = this.generateMessageId();
                }
            }
        }

        if (context.version < 2) {
            context.version = 2;
            if (!context.semanticIndex) {
                context.semanticIndex = [];
            }
        }

        if (!context.quickRepliesHistory) {
            context.quickRepliesHistory = [];
        }
    }

    private clampQuickRepliesHistory(
        history: QuickReplyHistoryEntry[],
    ): QuickReplyHistoryEntry[] {
        if (!history?.length) return [];

        const sorted = [...history].sort(
            (a, b) => (b.timestamp || 0) - (a.timestamp || 0),
        );

        return this.deduplicateQuickRepliesHistory(
            sorted,
            this.config.quickRepliesHistorySize,
        );
    }

    private async archive(
        sessionId: string,
        context: SessionContext,
    ): Promise<void> {
        try {
            await this.sessionContextRepo.saveArchive(
                sessionId,
                this.serialize(context),
                60 * 60 * 24 * 30,
            );
            await this.clear(sessionId);
            this.logger.log(`Session ${sessionId} archived`);
        } catch (error) {
            this.logger.error(`Failed to archive session ${sessionId}:`, error);
        }
    }

    private async save(
        sessionId: string,
        context: SessionContext,
    ): Promise<void> {
        const ttl = this.config.ttlMs / 1000;

        try {
            const serialized = this.serialize(context);
            await this.sessionContextRepo.set(
                sessionId,
                this.config.version,
                serialized,
                ttl,
            );
            this.logger.debug(
                `Session ${sessionId} saved, size: ${serialized.length} bytes`,
            );
        } catch (error) {
            this.logger.error(`Failed to save session ${sessionId}:`, error);
            throw error;
        }
    }

    private serialize(context: SessionContext): string {
        return JSON.stringify(context);
    }

    private deserialize(data: string): SessionContext {
        return JSON.parse(data) as SessionContext;
    }

    private deduplicateQuickRepliesHistory(
        history: QuickReplyHistoryEntry[],
        limit: number,
    ): QuickReplyHistoryEntry[] {
        const seen = new Set<string>();
        const result: QuickReplyHistoryEntry[] = [];

        for (const entry of history) {
            const textKey = entry.text.trim().toLowerCase();
            if (seen.has(textKey)) continue;
            seen.add(textKey);
            result.push(entry);
            if (result.length >= limit) break;
        }

        return result;
    }
}
