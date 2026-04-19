import { Injectable, Logger } from '@nestjs/common';
import {
    MessageHistory,
    ConversationSummary,
    SessionContext,
} from '../../common/types';
import { SessionContextRepository } from '../../repository';
import { estimateTokens, truncateAtWord } from '../../common/utils';
import {
    AGENT_PRIORITY,
    STOP_WORDS,
} from '../../common/constants/ai.constants';
import { SummarizationAgentService } from './summarization.agent';

@Injectable()
export class SummarizationRunnerService {
    private readonly logger = new Logger(SummarizationRunnerService.name);

    constructor(
        private readonly sessionContextRepo: SessionContextRepository,
        private readonly summarizationAgent: SummarizationAgentService,
    ) {}

    async isInProgress(sessionId: string): Promise<boolean> {
        return this.sessionContextRepo.hasSummarizationLock
            ? this.sessionContextRepo.hasSummarizationLock(sessionId)
            : false;
    }

    async run(
        sessionId: string,
        getContext: () => Promise<SessionContext | undefined>,
        saveContext: (context: SessionContext) => Promise<void>,
        lockTTL: number,
        compressHistory: (context: SessionContext) => void,
    ): Promise<void> {
        const acquired = await this.sessionContextRepo.acquireSummarizationLock(
            sessionId,
            lockTTL,
        );
        if (!acquired) {
            this.logger.debug(
                `Summarization already in progress for ${sessionId}`,
            );
            return;
        }

        try {
            const context = await getContext();
            if (!context) {
                this.logger.warn(
                    `No context found for summarization: ${sessionId}`,
                );
                return;
            }

            await this.updateSummary(sessionId, context);
            compressHistory(context);

            context.summarizationPending = false;
            await saveContext(context);

            this.logger.log(`Summarization completed for ${sessionId}`);
        } catch (error) {
            this.logger.error(`Summarization failed for ${sessionId}:`, error);
            const ctx = await getContext();
            if (ctx) {
                ctx.summarizationPending = false;
                await saveContext(ctx).catch(() => {});
            }
        } finally {
            await this.sessionContextRepo
                .releaseSummarizationLock(sessionId)
                .catch(() => {});
        }
    }

    createFallbackSummary(context: SessionContext): ConversationSummary {
        try {
            const recentMessages = context.messageHistory.slice(-15);
            const userMessages = recentMessages.filter(
                (m) => m.role === 'user',
            );
            const assistantMessages = recentMessages.filter(
                (m) => m.role === 'assistant',
            );

            const keywords = this.extractKeywords(userMessages);
            const shortSummary = this.buildShortSummary(userMessages);
            const longSummary = this.buildLongSummary(
                userMessages,
                assistantMessages,
                keywords,
            );
            const importantFacts =
                this.extractImportantFacts(assistantMessages);

            const summaryText = `${longSummary}\n\nТемы: ${keywords.join(', ')}`;
            const tokens = estimateTokens(summaryText);

            return {
                shortTermSummary: shortSummary,
                longTermSummary: longSummary,
                keyTopics: keywords,
                importantFacts,
                lastUpdated: Date.now(),
                tokens,
            };
        } catch (error) {
            this.logger.error('Fallback summary failed:', error);
            return this.getEmptySummary();
        }
    }

    private async updateSummary(
        sessionId: string,
        context: SessionContext,
    ): Promise<void> {
        // Keep last 5 messages as verbatim hot-tier; summarize everything before
        const messagesToSummarize = context.messageHistory.slice(0, -5);
        if (messagesToSummarize.length === 0) {
            context.summary = this.createFallbackSummary(context);
            return;
        }

        // Skip messages already included in a previous summary
        const newMessages = messagesToSummarize.filter((m) => !m.summarized);
        if (newMessages.length === 0) {
            return;
        }

        const conversationText = this.formatConversationForSummary(newMessages);

        try {
            const result = await this.summarizationAgent.process({
                sessionId,
                timestamp: new Date().toISOString(),
                conversationText,
                previousSummary: context.summary?.longTermSummary,
            });

            if (result.success) {
                context.summary = result.summary;

                // Mark summarized messages and set anchor
                const lastMessage = newMessages[newMessages.length - 1];
                for (const m of newMessages) {
                    m.summarized = true;
                }
                context.summary.lastSummarizedMessageId = lastMessage.id;

                this.logger.log(
                    `Summary updated: topics=${result.summary.keyTopics.length}, ` +
                        `facts=${result.summary.importantFacts.length}, ` +
                        `stage=${result.summary.stage || 'N/A'}`,
                );
            } else {
                throw new Error(result.error ?? 'Summarization agent failed');
            }
        } catch (error) {
            this.logger.error('Agent summary failed, using fallback:', error);
            context.summary = this.createFallbackSummary(context);
        }
    }

    private formatConversationForSummary(messages: MessageHistory[]): string {
        return messages
            .map((m) => {
                const role = m.role === 'user' ? 'Клиент' : 'Ассистент';
                return `${role}: ${m.content}`;
            })
            .join('\n');
    }

    private extractKeywords(messages: MessageHistory[]): string[] {
        const words = messages
            .flatMap((m) => m.content.toLowerCase().split(/[\s,;.!?()]+/))
            .map((word) => word.replace(/[«»"']/g, '').trim())
            .filter(
                (word) =>
                    word.length > 3 &&
                    !STOP_WORDS.has(word) &&
                    /^[а-яё0-9]+$/i.test(word),
            );

        return [...new Set(words)].slice(0, 10);
    }

    private buildShortSummary(messages: MessageHistory[]): string {
        if (!messages.length) return 'Новый диалог';

        const lastThree = messages.slice(-3);
        const parts = lastThree.map((m) => truncateAtWord(m.content, 80));
        return parts.join(' | ').slice(0, 250);
    }

    private buildLongSummary(
        userMessages: MessageHistory[],
        assistantMessages: MessageHistory[],
        keywords: string[],
    ): string {
        if (!userMessages.length) return 'Сессия только началась';

        if (userMessages.length === 1) {
            return `Клиент спросил: "${truncateAtWord(userMessages[0].content, 200)}"`;
        }

        const topics = keywords.slice(0, 5).join(', ');
        let summary = `Диалог: ${userMessages.length} запросов, ${assistantMessages.length} ответов. `;
        if (topics) summary += `Темы: ${topics}. `;

        const lastUser = userMessages[userMessages.length - 1];
        if (lastUser?.content) {
            summary += `Последний: "${truncateAtWord(lastUser.content, 100)}"`;
        }

        return summary.slice(0, 400);
    }

    private extractImportantFacts(messages: MessageHistory[]): string[] {
        const facts: string[] = [];
        const seen = new Set<string>();

        for (const msg of messages.slice(-6).reverse()) {
            if (facts.length >= 5) break;
            if (
                msg?.metadata?.confidence !== AGENT_PRIORITY.HIGH ||
                !msg.content ||
                msg.content.length < 30
            )
                continue;

            let fact = msg.content
                .replace(/\*\*/g, '')
                .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                .replace(/\n+/g, ' ')
                .trim();

            if (fact.length > 180) {
                const cutPoint = Math.max(
                    fact.lastIndexOf('.', 180),
                    fact.lastIndexOf(',', 180),
                    160,
                );
                fact = fact.slice(0, cutPoint).trim();
                if (!/[.!?,]$/.test(fact)) fact += '...';
            }

            const key = fact.slice(0, 40).toLowerCase();
            if (!seen.has(key)) {
                facts.push(fact);
                seen.add(key);
            }
        }

        return facts;
    }

    private getEmptySummary(): ConversationSummary {
        return {
            shortTermSummary: '',
            longTermSummary: '',
            keyTopics: [],
            importantFacts: [],
            lastUpdated: Date.now(),
            tokens: 0,
        };
    }
}
