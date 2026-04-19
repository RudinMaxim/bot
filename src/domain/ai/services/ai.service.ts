import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ResponseAgentOutput, ResponseAgentInput } from '../agents';
import {
    FeedbackMetadata,
    FastPathResult,
    ProcessResult,
    BatchProcessOptions,
    BatchResult,
    InputData,
    SessionContext,
    PipelineMetadata,
    PipelineCallbacks,
} from '../common/types';
import { InputValidationService } from './input-validation.service';
import { AgentOrchestratorService } from './orchestrator.service';
import { SessionContextService } from './session-context.service';
import { MetricsService } from './metrics.service';
import { FeedbackService } from './feedback.service';
import { AiCancellationService } from './ai-cancellation.service';
import { ErrorUtils } from 'src/shared/agents';
import { LocalesService } from 'src/domain/locales/services';
import { QueryCacheRepository } from '../repository';
import {
    extractErrorMessage,
    buildProcessingMetrics,
    ensureLocale,
    getLocalizedStringArray,
    resolveString,
    resolveStringOrNumber,
    resolveNonEmptyString,
} from '../common/utils';
import { AI_STATUS, FAST_PATH, SOURCE_TYPE } from '../common/constants';
import { DEFAULT_LOCALE, hashed, resolveLocale, t } from 'src/shared/utils';
import { redactForLog } from 'src/shared/security';

@Injectable()
export class AiService {
    private readonly logger = new Logger(AiService.name);

    constructor(
        private readonly orchestrator: AgentOrchestratorService,
        private readonly inputValidation: InputValidationService,
        private readonly sessionContext: SessionContextService,
        private readonly metricsService: MetricsService,
        private readonly feedbackService: FeedbackService,
        private readonly cancellation: AiCancellationService,
        private readonly queryCacheRepo: QueryCacheRepository,
        private readonly localesService: LocalesService,
    ) {}

    async processMessage(
        sessionId: string,
        chatInput: string,
        metadata?: Partial<PipelineMetadata>,
        callbacks?: PipelineCallbacks,
    ): Promise<ProcessResult<ResponseAgentOutput>> {
        const startTime = Date.now();
        const runId = String(metadata?.messageId ?? randomUUID());
        const { signal } = this.cancellation.startRun(sessionId, runId);
        let pipelineMetadata: PipelineMetadata | undefined;
        const locale = await ensureLocale(
            this.localesService,
            metadata?.locale,
            sessionId,
        );
        const enrichedMetadata = { ...metadata, locale };

        try {
            const { platform, user } = this.getUserMetadata(enrichedMetadata);
            this.logger.log(
                `[${sessionId}] Processing: ${redactForLog(chatInput)} | ` +
                    `Platform: ${platform} | User: ${user}`,
            );

            const validation = this.inputValidation.validateInput({
                sessionId,
                chatInput,
                metadata: enrichedMetadata,
            });

            if (!validation.isValid) {
                return this.handleValidationFailure(
                    sessionId,
                    chatInput,
                    validation.error ??
                        t('system.ai.validation.generic', undefined, locale),
                    locale,
                    startTime,
                );
            }

            await this.sessionContext.addMessage(
                sessionId,
                'user',
                chatInput,
                enrichedMetadata,
            );

            const sessionContextData = await this.sessionContext.get(sessionId);
            const conversationContext =
                await this.sessionContext.getConversationContext(
                    sessionId,
                    sessionContextData ?? undefined,
                );
            pipelineMetadata = this.buildPipelineMetadata(
                validation.metadata!,
                enrichedMetadata,
                sessionContextData,
                conversationContext,
            );
            pipelineMetadata.abortSignal = signal;

            const cachedResult = await this.tryRequestCache(
                sessionId,
                validation.cleanedInput!,
                pipelineMetadata,
                locale,
                startTime,
            );
            if (cachedResult) {
                await this.persistResultToContext(sessionId, cachedResult, {
                    locale,
                });
                await this.logMetricsSafe({
                    sessionId,
                    requestText: chatInput,
                    result: cachedResult,
                    startTime,
                });
                return cachedResult;
            }

            const fastResult = await this.tryFastPath(
                sessionId,
                chatInput,
                sessionContextData,
                conversationContext,
                pipelineMetadata,
                locale,
                startTime,
                callbacks,
            );
            if (fastResult) return fastResult;

            const orchestrationResult = await this.executeOrchestration(
                sessionId,
                validation.cleanedInput!,
                sessionContextData,
                conversationContext,
                pipelineMetadata,
                chatInput,
                locale,
                startTime,
                callbacks,
            );

            this.storeRequestCache(
                sessionId,
                validation.cleanedInput!,
                pipelineMetadata,
                orchestrationResult,
            ).catch((err) =>
                this.logger.warn(`[${sessionId}] Cache store failed: ${err}`),
            );

            return orchestrationResult;
        } catch (error) {
            return this.handleProcessingError(
                error,
                signal,
                sessionId,
                chatInput,
                locale,
                startTime,
                pipelineMetadata,
            );
        } finally {
            this.cancellation.completeRun(sessionId, runId);
        }
    }

    // ========== Pipeline Steps ==========

    private async handleValidationFailure(
        sessionId: string,
        chatInput: string,
        error: string,
        locale: string,
        startTime: number,
    ): Promise<ProcessResult<ResponseAgentOutput>> {
        const errorMessage = this.extractLocalizedError(error, locale);
        const errorResult = this.createErrorResult(
            sessionId,
            errorMessage,
            startTime,
        );
        await this.logMetricsSafe({
            sessionId,
            requestText: chatInput,
            result: errorResult,
            startTime,
        });
        return errorResult;
    }

    private async tryFastPath(
        sessionId: string,
        chatInput: string,
        context: SessionContext | undefined,
        conversationContext: string,
        metadata: PipelineMetadata,
        locale: string,
        startTime: number,
        callbacks?: PipelineCallbacks,
    ): Promise<ProcessResult<ResponseAgentOutput> | null> {
        void sessionId;
        void chatInput;
        void context;
        void conversationContext;
        void metadata;
        void locale;
        void startTime;
        void callbacks;
        return null;
    }

    private async executeOrchestration(
        sessionId: string,
        cleanedInput: string,
        sessionContextData: SessionContext | undefined,
        conversationContext: string,
        metadata: PipelineMetadata,
        chatInput: string,
        locale: string,
        startTime: number,
        callbacks?: PipelineCallbacks,
    ): Promise<ProcessResult<ResponseAgentOutput>> {
        const result = await this.orchestrator.orchestrateWorkflow(
            sessionId,
            cleanedInput,
            sessionContextData,
            conversationContext,
            metadata,
            startTime,
            callbacks,
        );

        this.persistResultToContext(sessionId, result, { locale }).catch(
            (err) =>
                this.logger.warn(
                    `[${sessionId}] Context persist failed: ${err}`,
                ),
        );

        const processingTime = Date.now() - startTime;
        if (!result.success && result.error === AI_STATUS.CANCELLED) {
            this.logger.log(`[${sessionId}] Cancelled in ${processingTime}ms`);
        } else {
            this.logger.log(
                `[${sessionId}] Orchestrator completed in ${processingTime}ms | ` +
                    `QuickReplies: ${result.data?.quickReplies?.length || 0}`,
            );
        }

        this.logMetricsSafe({
            sessionId,
            requestText: chatInput,
            result,
            startTime,
        }).catch(() => {});
        return result;
    }

    private async handleProcessingError(
        error: unknown,
        signal: AbortSignal,
        sessionId: string,
        chatInput: string,
        locale: string,
        startTime: number,
        pipelineMetadata?: PipelineMetadata,
    ): Promise<ProcessResult<ResponseAgentOutput>> {
        if (signal.aborted || ErrorUtils.isCancellationError(error)) {
            const cancelledResult = this.createErrorResult(
                sessionId,
                AI_STATUS.CANCELLED,
                startTime,
                pipelineMetadata,
            );
            await this.logMetricsSafe({
                sessionId,
                requestText: chatInput,
                result: cancelledResult,
                startTime,
            });
            return cancelledResult;
        }

        this.logger.error(
            `Error processing message for session ${sessionId}:`,
            error,
        );
        const errorMessage = this.extractLocalizedError(error, locale);
        const errorResult = this.createErrorResult(
            sessionId,
            errorMessage,
            startTime,
        );
        await this.logMetricsSafe({
            sessionId,
            requestText: chatInput,
            result: errorResult,
            startTime,
        });
        return errorResult;
    }

    cancelProcessing(sessionId: string, reason?: string): boolean {
        return this.cancellation.cancel(
            sessionId,
            reason ?? AI_STATUS.CANCELLED,
        );
    }

    wasRunCancelled(sessionId: string, runId: string): boolean {
        return this.cancellation.wasCancelled(sessionId, runId);
    }

    async clearSession(sessionId: string): Promise<void> {
        const exists = await this.sessionContext.exists(sessionId);
        if (!exists) {
            this.logger.warn(`[${sessionId}] Session does not exist`);
            return;
        }
        await this.sessionContext.clear(sessionId);
        this.logger.log(`[${sessionId}] Session cleared`);
    }

    async processBatch(
        inputs: InputData[],
        options: BatchProcessOptions = {},
    ): Promise<BatchResult<ResponseAgentOutput>> {
        const startTime = Date.now();
        const { concurrency = 5, stopOnFirstError = false } = options;

        if (inputs.length === 0) {
            return this.createBatchResult([], startTime);
        }

        const results: ProcessResult<ResponseAgentOutput>[] = [];

        for (let i = 0; i < inputs.length; i += concurrency) {
            const batch = inputs.slice(i, i + concurrency);

            const batchPromises = batch.map((input) =>
                this.processMessage(
                    input.sessionId,
                    input.chatInput,
                    input.metadata,
                ).catch((error) => {
                    this.logger.error(
                        `Batch processing error for session ${input.sessionId}:`,
                        error,
                    );
                    const locale = resolveLocale(input.metadata?.locale);
                    return this.createErrorResult<ResponseAgentOutput>(
                        input.sessionId,
                        this.extractLocalizedError(error, locale),
                        Date.now(),
                    );
                }),
            );

            const batchResults = await Promise.allSettled(batchPromises);

            for (const result of batchResults) {
                if (result.status === 'fulfilled') {
                    results.push(result.value);

                    if (stopOnFirstError && !result.value.success) {
                        this.logger.warn(
                            'Stopping batch processing due to error',
                        );
                        return this.createBatchResult(results, startTime);
                    }
                } else {
                    this.logger.error('Batch promise rejected:', result.reason);
                    results.push(
                        this.createErrorResult<ResponseAgentOutput>(
                            AI_STATUS.UNKNOWN,
                            t(
                                'system.ai.errors.batchPromiseRejection',
                                undefined,
                                DEFAULT_LOCALE,
                            ),
                            Date.now(),
                        ),
                    );
                }
            }
        }

        return this.createBatchResult<ResponseAgentOutput>(results, startTime);
    }

    async logFeedback(
        requestText: string,
        responseText: string,
        feedbackValue: number,
        metadata: FeedbackMetadata,
    ): Promise<void> {
        await this.feedbackService.log({
            sessionId: metadata.sessionId,
            requestText,
            responseText,
            feedbackValue,
            metadata: {
                timestamp: metadata.timestamp || new Date().toISOString(),
                platform: metadata.platform,
                userId: metadata.userId,
                confidence: metadata.confidence,
                agentsUsed: metadata.agentsUsed,
                processingTimeMs: metadata.processingTimeMs,
                searchResultsCount: metadata.searchResultsCount,
                analysisResultsCount: metadata.analysisResultsCount,
                hasUrl: metadata.hasUrl,
            },
        });
    }

    // ========== Приватные методы: Контекст ==========

    private async persistResultToContext(
        sessionId: string,
        result: ProcessResult<ResponseAgentOutput>,
        options: { fastPath?: boolean; locale?: string } = {},
    ): Promise<void> {
        if (!result.success || !result.data) return;

        try {
            if (result.data.quickReplies?.length) {
                await this.sessionContext.updateQuickRepliesHistory(
                    sessionId,
                    result.data.quickReplies,
                );
            }

            if (result.contextUpdate) {
                await this.sessionContext.updateContact(
                    sessionId,
                    result.contextUpdate.contact ?? {},
                    options.locale,
                );
            }

            if (result.data.response) {
                await this.sessionContext.addMessage(
                    sessionId,
                    'assistant',
                    result.data.response,
                    {
                        confidence: result.data.confidence,
                        agentsUsed: result.data.metadata?.agentsProcessed,
                        quickReplies: result.data.quickReplies ?? [],
                        ...(options.fastPath && { fastPath: true }),
                    },
                );

                this.sessionContext
                    .triggerSummarizationIfNeeded(sessionId)
                    .catch((err) =>
                        this.logger.warn(
                            `[${sessionId}] Summarization trigger failed: ${err}`,
                        ),
                    );
            }
        } catch (error) {
            this.logger.warn(
                `[${sessionId}] Failed to persist result to context`,
                error,
            );
        }
    }

    private async tryRequestCache(
        sessionId: string,
        cleanedInput: string,
        metadata: PipelineMetadata,
        locale: string,
        startTime: number,
    ): Promise<ProcessResult<ResponseAgentOutput> | null> {
        const cacheKey = this.buildRequestCacheKey(cleanedInput, metadata);
        if (!cacheKey) {
            return null;
        }

        const cached = await this.queryCacheRepo.get(cacheKey);
        if (!cached?.success || !cached.data) {
            return null;
        }

        const hydrated = this.hydrateCachedResult(
            sessionId,
            cached,
            metadata,
            startTime,
        );

        this.logger.log(
            `[${sessionId}] Response cache hit for ${redactForLog(cleanedInput)} | Locale: ${locale}`,
        );

        return hydrated;
    }

    private async storeRequestCache(
        sessionId: string,
        cleanedInput: string,
        metadata: PipelineMetadata,
        result: ProcessResult<ResponseAgentOutput>,
    ): Promise<void> {
        if (!result.success || !result.data) {
            return;
        }

        const cacheKey = this.buildRequestCacheKey(cleanedInput, metadata);
        if (!cacheKey) {
            return;
        }

        await this.queryCacheRepo.set(cacheKey, result);
        this.logger.debug(
            `[${sessionId}] Response cached for ${redactForLog(cleanedInput)}`,
        );
    }

    private hydrateCachedResult(
        sessionId: string,
        cached: ProcessResult<ResponseAgentOutput>,
        metadata: PipelineMetadata,
        startTime: number,
    ): ProcessResult<ResponseAgentOutput> {
        const executionTime = Math.max(Date.now() - startTime, 0);

        return {
            ...cached,
            sessionId,
            timestamp: new Date().toISOString(),
            processingTimeMs: executionTime,
            metrics: cached.metrics
                ? {
                      ...cached.metrics,
                      executionTime,
                  }
                : undefined,
            metadata,
            data: cached.data
                ? {
                      ...cached.data,
                      metadata: {
                          ...cached.data.metadata,
                          extras: {
                              ...(cached.data.metadata.extras ?? {}),
                              cacheHit: true,
                          },
                      },
                  }
                : cached.data,
        };
    }

    // ========== Приватные методы: Fast Path ==========
    private evaluateFastPath(
        chatInput: string,
        context: SessionContext | undefined,
        conversationContext: string,
        locale: ReturnType<typeof resolveLocale>,
    ): FastPathResult {
        const assistantProfile = this.matchAssistantProfileFastPath(
            chatInput,
            locale,
        );
        if (assistantProfile) {
            return assistantProfile;
        }

        if (!context || !conversationContext) {
            return {
                shouldUseFastPath: false,
                score: 0,
                reason: 'No context available',
            };
        }

        let score = 0;
        const reasons: string[] = [];

        if (context.summary?.longTermSummary) {
            const summaryLower = context.summary.longTermSummary.toLowerCase();
            const inputLower = chatInput.toLowerCase().slice(0, 50);

            if (summaryLower.includes(inputLower)) {
                score += FAST_PATH.SUMMARY_MATCH;
                reasons.push('Match in summary');
            }
        }

        if (context.summary?.importantFacts?.length) {
            const hasFactMatch = context.summary.importantFacts.some((fact) =>
                chatInput
                    .toLowerCase()
                    .includes(fact.toLowerCase().slice(0, 30)),
            );
            if (hasFactMatch) {
                score += FAST_PATH.FACTS_MATCH;
                reasons.push('Match in facts');
            }
        }

        const loweredInput = chatInput.toLowerCase();
        const contactKeywords = getLocalizedStringArray(
            'system.ai.fastPath.contactKeywords',
            locale,
        );
        const isContactRequest = contactKeywords.some((keyword) =>
            loweredInput.includes(keyword),
        );

        if (isContactRequest && context.contact) {
            if (context.contact.clientName && context.contact.contactInfo) {
                score += FAST_PATH.CONTACT_KEYWORDS;
                reasons.push('Contact info ready');
            }
        }

        if (context.messageHistory?.length > 0) {
            const hasHistoryMatch = context.messageHistory.some((msg) =>
                msg.content.toLowerCase().includes(chatInput.toLowerCase()),
            );
            if (hasHistoryMatch) {
                score += FAST_PATH.HISTORY_MATCH;
                reasons.push('Match in history');
            }
        }

        const finalScore = Math.min(score, 1);
        const shouldUseFastPath = finalScore >= FAST_PATH.THRESHOLD;

        return {
            shouldUseFastPath,
            score: finalScore,
            reason: reasons.join('; ') || 'No match',
        };
    }

    private async processFastPath(
        sessionId: string,
        chatInput: string,
        conversationContext: string,
        metadata: PipelineMetadata,
        fastPathCheck: FastPathResult,
        startTime: number,
        locale: ReturnType<typeof resolveLocale>,
        callbacks?: PipelineCallbacks,
    ): Promise<ProcessResult<ResponseAgentOutput> | null> {
        try {
            this.logger.log(
                `[${sessionId}] Attempting fast path | Score: ${fastPathCheck.score.toFixed(2)} | ` +
                    `Reason: ${fastPathCheck.reason}`,
            );

            const fastContext =
                fastPathCheck.contextOverride ?? conversationContext;
            const fastContextSource =
                fastPathCheck.contextSource ?? 'session_context';

            const fastMetadata: PipelineMetadata = {
                ...metadata,
                conversationContext: fastContext,
                fastPath: true,
                readinessReason: fastPathCheck.reason,
                timestamp: new Date().toISOString(),
                originalLength: chatInput.length,
                cleanedLength: chatInput.length,
            };

            const fastInput: ResponseAgentInput = {
                sessionId,
                originalQuery: chatInput,
                searchResults: [],
                analysisResults: [
                    {
                        taskId: 'fast_context',
                        instruction: this.getFastPathInstruction(locale),
                        data: fastContext,
                        confidence: fastPathCheck.score,
                        propertyCards: [],
                        metadata: {
                            dataSources: [fastContextSource],
                            executionTime: 0,
                            calculationsPerformed: [],
                        },
                        success: true,
                    },
                ],
                sourceType: SOURCE_TYPE.CONTEXT,
                confidenceScore: fastPathCheck.score,
                status: AI_STATUS.COMPLETED,
                timestamp: new Date().toISOString(),
                streaming: callbacks?.onResponseChunk
                    ? {
                          onTextChunk: (chunk, text) => {
                              callbacks.onResponseChunk?.({ chunk, text });
                          },
                      }
                    : undefined,
                metadata: fastMetadata,
            };

            const fastResponse =
                await this.orchestrator.processFastResponse(fastInput);
            return this.createSuccessResult(
                sessionId,
                fastResponse,
                startTime,
                fastMetadata,
            );
        } catch (error) {
            const signal = metadata.abortSignal;
            if (signal?.aborted || ErrorUtils.isCancellationError(error)) {
                throw error;
            }
            this.logger.warn(
                `Fast path failed for ${sessionId}, fallback to orchestrator:`,
                error,
            );
            return null;
        }
    }

    private matchAssistantProfileFastPath(
        chatInput: string,
        locale: ReturnType<typeof resolveLocale>,
    ): FastPathResult | null {
        const normalized = chatInput.trim().toLowerCase();
        if (!normalized) {
            return null;
        }

        if (
            !/(кто\s+ты|как\s+тебя\s+зовут|твое\s+имя|тво[её]\s+имя|что\s+ты\s+умеешь|чем\s+можешь\s+помочь|какие\s+у\s+тебя\s+возможности|who\s+are\s+you|what\s+is\s+your\s+name|what\s+can\s+you\s+do|how\s+can\s+you\s+help)/iu.test(
                normalized,
            )
        ) {
            return null;
        }

        return {
            shouldUseFastPath: true,
            score: 0.95,
            reason: 'assistant_profile',
            contextOverride: this.getAssistantProfileContext(locale),
            contextSource: 'assistant_profile',
        };
    }

    private getFastPathInstruction(
        locale: ReturnType<typeof resolveLocale>,
    ): string {
        const value = t('system.ai.fastPath.instruction', undefined, locale);
        if (value !== 'system.ai.fastPath.instruction') {
            return value;
        }

        return locale === 'en'
            ? 'Use fast-path knowledge'
            : 'Используй знания быстрого пути';
    }

    private getAssistantProfileContext(
        locale: ReturnType<typeof resolveLocale>,
    ): string {
        const value = t('system.ai.fastPath.assistantInfo', undefined, locale);
        if (value !== 'system.ai.fastPath.assistantInfo') {
            return value;
        }

        return locale === 'en'
            ? 'Your name is Andrey. You are the Mys residential project chat assistant for MR Group. Sound warm, natural, and practical, like a thoughtful consultant in chat. Help with apartment selection, payment options, mortgages, infrastructure, construction timelines, consultations, and site navigation. If the user asks who you are or what your name is, introduce yourself briefly in a human way and suggest the next useful step.'
            : 'Тебя зовут Андрей. Ты живой чат-ассистент по ЖК «Мыс» от MR Group. Общайся тепло, естественно и по делу, как внимательный консультант в переписке. Помогай с подбором квартир, условиями покупки, ипотекой, инфраструктурой, сроками строительства, консультациями и навигацией по сайту. Если пользователь спрашивает, кто ты или как тебя зовут, представься коротко и по-человечески и предложи следующий полезный шаг.';
    }

    // ========== Приватные методы: Результаты ==========

    private createSuccessResult(
        sessionId: string,
        data: ResponseAgentOutput,
        startTime: number,
        metadata?: PipelineMetadata,
    ): ProcessResult<ResponseAgentOutput> {
        const metrics = buildProcessingMetrics({ data, startTime, metadata });
        const processingTime = metrics.executionTime;

        this.logger.log(
            `[${sessionId}] ✅ Request completed in ${processingTime}ms | ` +
                `Confidence: ${String(data.confidence)} | ` +
                `Coordinator: ${String(data.metadata.coordinatorConfidence ?? 'N/A')} | ` +
                `Agents: ${Number(data.metadata.agentsProcessed ?? 0)} | ` +
                `Search: ${Number(data.metadata.searchResultsCount ?? 0)} | ` +
                `Analysis: ${Number(data.metadata.analysisResultsCount ?? 0)} | ` +
                `QuickReplies: ${data.quickReplies?.length || 0}`,
        );

        return {
            success: true,
            data: {
                ...data,
                metadata: {
                    ...data.metadata,
                    quickReplies: data.quickReplies,
                },
            },
            sessionId,
            timestamp: new Date().toISOString(),
            processingTimeMs: processingTime,
            metrics,
        };
    }

    private createErrorResult<T = ResponseAgentOutput>(
        sessionId: string,
        error: string,
        startTime: number,
        metadata?: PipelineMetadata,
    ): ProcessResult<T> {
        const metrics = buildProcessingMetrics({
            startTime,
            metadata,
            isError: true,
        });
        const processingTime = metrics.executionTime;

        this.logger.error(
            `[${sessionId}] ❌ Request failed after ${processingTime}ms | Error: ${error}`,
        );

        return {
            success: false,
            error,
            sessionId,
            timestamp: new Date().toISOString(),
            processingTimeMs: processingTime,
            metrics,
        };
    }

    private createBatchResult<T = ResponseAgentOutput>(
        results: ProcessResult<T>[],
        startTime: number,
    ): BatchResult<T> {
        const successful = results.filter((r) => r.success).length;

        return {
            results,
            summary: {
                total: results.length,
                successful,
                failed: results.length - successful,
                processingTimeMs: Date.now() - startTime,
            },
        };
    }

    // ========== Утилиты ==========

    private buildPipelineMetadata(
        baseMetadata: PipelineMetadata,
        incoming: Partial<PipelineMetadata> | undefined,
        sessionContext: SessionContext | undefined,
        conversationContext: string,
    ): PipelineMetadata {
        return {
            ...incoming,
            ...baseMetadata,
            timestamp:
                baseMetadata.timestamp ??
                incoming?.timestamp ??
                new Date().toISOString(),
            platform: resolveString(incoming?.platform, baseMetadata.platform),
            userId: resolveNonEmptyString(incoming?.userId),
            originalInput: resolveString(
                incoming?.originalInput,
                baseMetadata.originalInput,
                '',
            ),
            sessionContext,
            conversationContext,
        };
    }

    private buildRequestCacheKey(
        cleanedInput: string,
        metadata: PipelineMetadata,
    ): string | null {
        const query = this.normalizeQueryForCache(cleanedInput);
        if (!query) {
            return null;
        }

        const payload = {
            locale: resolveLocale(metadata.locale),
            query,
            quickReplyIntent:
                resolveNonEmptyString(metadata.quickReplyIntent) ?? null,
            quickReplyPayload: this.normalizeJsonValue(
                metadata.quickReplyPayload,
            ),
            inputType: metadata.inputType ?? null,
            siteContext: this.extractSiteContextForCache(metadata),
            conversation: this.normalizeConversationContextForCache(
                metadata.conversationContext,
            ),
        };

        return hashed(JSON.stringify(payload));
    }

    private normalizeQueryForCache(query: string): string {
        return query
            .toLowerCase()
            .replace(/ё/g, 'е')
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private normalizeConversationContextForCache(
        conversationContext?: string,
    ): string | null {
        if (!conversationContext?.trim()) {
            return null;
        }

        const normalized = conversationContext
            .replace(/\[Токены:[^\]]+\]/gu, ' ')
            .replace(/\[Суммаризация в процессе\.\.\.\]/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();

        return normalized ? hashed(normalized) : null;
    }

    private extractSiteContextForCache(
        metadata: PipelineMetadata,
    ): Record<string, string> | null {
        const extras = metadata.extras as Record<string, unknown> | undefined;
        const rawContext = extras?.siteAssistantContext;
        if (!rawContext || typeof rawContext !== 'object') {
            return null;
        }

        const currentUrl = this.normalizeUrlForCache(
            (rawContext as { current_url?: unknown }).current_url,
        );
        const locale = this.normalizeTextForCache(
            (rawContext as { current_locale?: unknown }).current_locale,
        );
        const language = this.normalizeTextForCache(
            (rawContext as { current_language?: unknown }).current_language,
        );

        const normalized = Object.entries({
            current_url: currentUrl,
            current_locale: locale,
            current_language: language,
        }).reduce<Record<string, string>>((acc, [key, value]) => {
            if (value) {
                acc[key] = value;
            }
            return acc;
        }, {});

        return Object.keys(normalized).length > 0 ? normalized : null;
    }

    private normalizeUrlForCache(value: unknown): string | null {
        if (typeof value !== 'string') {
            return null;
        }

        const normalized = value.trim().toLowerCase().replace(/\/+$/g, '');
        return normalized || null;
    }

    private normalizeTextForCache(value: unknown): string | null {
        if (typeof value !== 'string') {
            return null;
        }

        const normalized = value.trim().toLowerCase();
        return normalized || null;
    }

    private normalizeJsonValue(value: unknown): unknown {
        if (Array.isArray(value)) {
            return value.map((item) => this.normalizeJsonValue(item));
        }

        if (value && typeof value === 'object') {
            return Object.keys(value as Record<string, unknown>)
                .sort()
                .reduce<Record<string, unknown>>((acc, key) => {
                    acc[key] = this.normalizeJsonValue(
                        (value as Record<string, unknown>)[key],
                    );
                    return acc;
                }, {});
        }

        return value;
    }

    private getUserMetadata(metadata: Partial<PipelineMetadata> | undefined): {
        platform: string;
        user: string;
    } {
        const platform = resolveString(metadata?.platform, undefined);
        const user =
            resolveStringOrNumber(metadata?.userId) !== undefined
                ? String(metadata!.userId)
                : AI_STATUS.UNKNOWN;
        return { platform, user };
    }

    private extractLocalizedError(
        error: unknown,
        locale?: ReturnType<typeof resolveLocale>,
    ): string {
        if (error instanceof Error || typeof error === 'string') {
            return extractErrorMessage(error);
        }
        return t(
            'system.ai.errors.unknownProcessing',
            undefined,
            resolveLocale(locale),
        );
    }

    private async logMetricsSafe(params: {
        sessionId: string;
        requestText: string;
        result: ProcessResult<ResponseAgentOutput>;
        startTime: number;
    }): Promise<void> {
        try {
            await this.metricsService.log(params);
        } catch (error) {
            this.logger.warn(
                `[${params.sessionId}] Skipping metrics logging: ${extractErrorMessage(error)}`,
            );
        }
    }
}
