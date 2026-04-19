import { Injectable, Logger } from '@nestjs/common';
import {
    CoordinatorAgent,
    CoordinatorInput,
    CoordinatorResponse,
    ResponseAgent,
    ResponseAgentInput,
    ResponseAgentOutput,
    SearchAgent,
    SearchAgentInput,
    SearchResult,
} from '../agents';
import type {
    PipelineCallbacks,
    PipelineMetadata,
    ProcessResult,
    ProcessingMetrics,
    ProgressiveResponsePayload,
    SessionContext,
} from '../common/types';
import { buildProcessingMetrics, ensureLocale, toFiniteNumber } from '../common/utils';
import {
    AGENT_NAME,
    AGENT_PRIORITY,
    AI_STATUS,
    ASSISTANT_MODE,
    CONFIDENCE,
    SOURCE_TYPE,
} from '../common/constants';
import { EmbeddingService } from 'src/domain/search-base';
import { LocalesService } from 'src/domain/locales/services';
import { ErrorUtils, type IProcessingMetrics } from 'src/shared/agents';
import { ProcessingPhase } from 'src/shared/types/processing-phase';
import { SpecialistCatalogService } from './specialist-catalog.service';
import type { SupportedLocale } from '../common/utils';

type SearchCoverage = 'full' | 'partial' | 'none';

@Injectable()
export class AgentOrchestratorService {
    private readonly logger = new Logger(AgentOrchestratorService.name);

    constructor(
        private readonly coordinatorAgent: CoordinatorAgent,
        private readonly searchAgent: SearchAgent,
        private readonly responseAgent: ResponseAgent,
        private readonly specialistCatalog: SpecialistCatalogService,
        private readonly localesService: LocalesService,
        private readonly embeddingService: EmbeddingService,
    ) {}

    async orchestrateWorkflow(
        sessionId: string,
        cleanedInput: string,
        sessionContextData: SessionContext | undefined,
        conversationContext: string,
        metadata: PipelineMetadata,
        startTime: number,
        callbacks?: PipelineCallbacks,
    ): Promise<ProcessResult<ResponseAgentOutput>> {
        const abortSignal = metadata.abortSignal;
        this.throwIfCancelled(sessionId, abortSignal);

        this.logger.log(`[${sessionId}] Starting workflow orchestration`);
        const locale = await ensureLocale(
            this.localesService,
            metadata.locale,
            sessionId,
        );

        const coordinatorMetadata: PipelineMetadata = {
            ...metadata,
            sessionContext: metadata.sessionContext ?? sessionContextData,
            conversationContext,
            originalInput: metadata.originalInput ?? cleanedInput,
            timestamp: metadata.timestamp ?? new Date().toISOString(),
            abortSignal,
        };

        const coordinatorInput: CoordinatorInput = {
            sessionId,
            input: cleanedInput,
            timestamp:
                coordinatorMetadata.timestamp ?? new Date().toISOString(),
            metadata: coordinatorMetadata,
        };

        try {
            callbacks?.onPhase?.(ProcessingPhase.THINKING);

            this.embeddingService.generateEmbedding(cleanedInput).catch(() => {});

            const coordinatorResult = await this.raceWithAbort(
                this.coordinatorAgent.process(coordinatorInput),
                abortSignal,
            );

            this.throwIfCancelled(sessionId, abortSignal);

            if (
                this.shouldUseCoordinatorClarification(
                    sessionId,
                    coordinatorResult,
                )
            ) {
                return this.handleClarification(
                    sessionId,
                    cleanedInput,
                    coordinatorResult,
                    coordinatorMetadata,
                    startTime,
                    abortSignal,
                    locale,
                    callbacks,
                );
            }

            callbacks?.onPhase?.(ProcessingPhase.SEARCHING);

            const searchResponse = await this.raceWithAbort(
                this.searchAgent.process(
                    this.buildSearchInput(cleanedInput, coordinatorResult, coordinatorMetadata),
                ),
                abortSignal,
            );

            this.throwIfCancelled(sessionId, abortSignal);

            const searchResults = [...searchResponse.searchResults];
            const finalMode = this.resolveFinalMode(
                coordinatorResult,
                searchResults,
            );
            const specialistRecord =
                finalMode === ASSISTANT_MODE.ANSWER
                    ? undefined
                    : this.specialistCatalog.findBestMatch(cleanedInput);
            const specialist =
                specialistRecord &&
                this.specialistCatalog.toSpecialistInfo(
                    specialistRecord,
                    coordinatorResult.routingReason ??
                        'Поможет по вопросам аккредитации',
                );

            const responseInput = this.buildResponseInput({
                sessionId,
                cleanedInput,
                coordinatorMetadata,
                coordinatorResult,
                searchResults,
                finalMode,
                specialist,
                abortSignal,
            });

            this.emitProgressiveResponse(
                callbacks,
                this.buildProgressiveResponsePayload(responseInput, locale),
            );

            callbacks?.onPhase?.(ProcessingPhase.GENERATING);

            const streamedResponseInput = callbacks?.onResponseChunk
                ? {
                      ...responseInput,
                      streaming: {
                          onTextChunk: (chunk: string, text: string) => {
                              callbacks.onResponseChunk?.({ chunk, text });
                          },
                      },
                  }
                : responseInput;

            const finalResponse = await this.raceWithAbort(
                this.responseAgent.process(streamedResponseInput),
                abortSignal,
            );

            return this.createSuccessResult(
                sessionId,
                finalResponse,
                startTime,
                responseInput.metadata,
                [
                    coordinatorResult.metrics,
                    searchResponse.metrics,
                    finalResponse.metrics,
                ],
            );
        } catch (error) {
            if (abortSignal?.aborted || ErrorUtils.isCancellationError(error)) {
                return this.createCancelledResult(
                    sessionId,
                    startTime,
                    coordinatorMetadata,
                );
            }
            throw error;
        }
    }

    async processFastResponse(
        input: ResponseAgentInput,
    ): Promise<ResponseAgentOutput> {
        return this.responseAgent.process(input);
    }

    private shouldUseCoordinatorClarification(
        sessionId: string,
        coordinatorResult: CoordinatorResponse,
    ): boolean {
        const needsClarification =
            coordinatorResult.mode === ASSISTANT_MODE.CLARIFY ||
            Boolean(coordinatorResult.shouldClarify) ||
            (coordinatorResult.clarificationQuestions?.length ?? 0) > 0;

        this.logger.debug(
            `[${sessionId}] Clarification check: mode=${coordinatorResult.mode}, ` +
                `questions=${coordinatorResult.clarificationQuestions?.length ?? 0}`,
        );

        return needsClarification;
    }

    private async handleClarification(
        sessionId: string,
        cleanedInput: string,
        coordinatorResult: CoordinatorResponse,
        coordinatorMetadata: PipelineMetadata,
        startTime: number,
        abortSignal: AbortSignal | undefined,
        locale: SupportedLocale,
        callbacks?: PipelineCallbacks,
    ): Promise<ProcessResult<ResponseAgentOutput>> {
        const clarificationInput: ResponseAgentInput = {
            sessionId,
            originalQuery: cleanedInput,
            mode: ASSISTANT_MODE.CLARIFY,
            searchResults: [],
            analysisResults: [],
            clarificationQuestions: coordinatorResult.clarificationQuestions,
            sourceType: SOURCE_TYPE.CLARIFICATION,
            confidenceScore: CONFIDENCE.CLARIFICATION,
            status: AI_STATUS.PARTIAL,
            timestamp: new Date().toISOString(),
            metadata: {
                ...coordinatorMetadata,
                abortSignal,
                shouldClarify: true,
                clarificationQuestions:
                    coordinatorResult.clarificationQuestions,
                coordinatorConfidence: coordinatorResult.overallConfidence,
                resolvedLocale: locale,
                extras: {
                    ...(coordinatorMetadata.extras ?? {}),
                    assistantMode: ASSISTANT_MODE.CLARIFY,
                },
            },
            streaming: callbacks?.onResponseChunk
                ? {
                      onTextChunk: (chunk, text) => {
                          callbacks.onResponseChunk?.({ chunk, text });
                      },
                  }
                : undefined,
        };

        this.emitProgressiveResponse(
            callbacks,
            this.buildProgressiveResponsePayload(clarificationInput, locale),
        );

        callbacks?.onPhase?.(ProcessingPhase.GENERATING);

        const clarificationResponse = await this.raceWithAbort(
            this.responseAgent.process(clarificationInput),
            abortSignal,
        );

        return this.createSuccessResult(
            sessionId,
            clarificationResponse,
            startTime,
            clarificationInput.metadata,
            [coordinatorResult.metrics, clarificationResponse.metrics],
        );
    }

    private buildSearchInput(
        cleanedInput: string,
        coordinatorResult: CoordinatorResponse,
        metadata: PipelineMetadata,
    ): SearchAgentInput {
        return {
            sessionId: coordinatorResult.sessionId,
            timestamp: coordinatorResult.timestamp,
            metadata,
            agents:
                coordinatorResult.agents.length > 0
                    ? coordinatorResult.agents
                    : [
                          {
                              agent_name: AGENT_NAME.SEARCH,
                              priority: AGENT_PRIORITY.HIGH,
                              tasks: [
                                  {
                                      instruction: cleanedInput,
                                      parameters: {
                                          query: cleanedInput,
                                      },
                                  },
                              ],
                          },
                      ],
        };
    }

    private resolveFinalMode(
        coordinatorResult: CoordinatorResponse,
        searchResults: ReadonlyArray<SearchResult>,
    ): CoordinatorResponse['mode'] {
        if (coordinatorResult.mode === ASSISTANT_MODE.ROUTE_TO_SPECIALIST) {
            return ASSISTANT_MODE.ROUTE_TO_SPECIALIST;
        }

        if (
            coordinatorResult.mode === ASSISTANT_MODE.PARTIAL_WITH_SPECIALIST
        ) {
            return ASSISTANT_MODE.PARTIAL_WITH_SPECIALIST;
        }

        const coverage = this.resolveCoverage(searchResults);
        if (coverage === 'none') {
            return ASSISTANT_MODE.ROUTE_TO_SPECIALIST;
        }

        if (coverage === 'partial') {
            return ASSISTANT_MODE.PARTIAL_WITH_SPECIALIST;
        }

        return ASSISTANT_MODE.ANSWER;
    }

    private resolveCoverage(
        searchResults: ReadonlyArray<SearchResult>,
    ): SearchCoverage {
        const explicitCoverage = searchResults
            .map(
                (result) =>
                    (
                        result.metadata as SearchResult['metadata'] & {
                            coverage?: SearchCoverage;
                        }
                    ).coverage,
            )
            .find((coverage): coverage is SearchCoverage => Boolean(coverage));

        if (explicitCoverage) {
            return explicitCoverage;
        }

        const hasAnswerable = searchResults.some(
            (result) =>
                result.metadata.answerability === 'answerable' &&
                result.results.length > 0,
        );

        if (hasAnswerable) {
            return 'full';
        }

        return 'none';
    }

    private buildResponseInput(params: {
        sessionId: string;
        cleanedInput: string;
        coordinatorMetadata: PipelineMetadata;
        coordinatorResult: CoordinatorResponse;
        searchResults: SearchResult[];
        finalMode: CoordinatorResponse['mode'];
        specialist?: ReturnType<SpecialistCatalogService['toSpecialistInfo']>;
        abortSignal?: AbortSignal;
    }): ResponseAgentInput {
        const status =
            params.finalMode === ASSISTANT_MODE.ANSWER
                ? AI_STATUS.COMPLETED
                : params.finalMode === ASSISTANT_MODE.CLARIFY
                  ? AI_STATUS.PARTIAL
                  : AI_STATUS.FAILED;

        return {
            sessionId: params.sessionId,
            originalQuery: params.cleanedInput,
            mode: params.finalMode,
            searchResults: params.searchResults,
            analysisResults: [],
            clarificationQuestions: params.coordinatorResult.clarificationQuestions,
            specialist: params.specialist,
            sourceType: SOURCE_TYPE.SEARCH,
            confidenceScore: params.coordinatorResult.overallConfidence,
            status,
            timestamp: new Date().toISOString(),
            metadata: {
                ...params.coordinatorMetadata,
                abortSignal: params.abortSignal,
                coordinatorConfidence:
                    params.coordinatorResult.overallConfidence,
                shouldClarify:
                    params.finalMode === ASSISTANT_MODE.CLARIFY,
                clarificationQuestions:
                    params.coordinatorResult.clarificationQuestions,
                agentsProcessed: 1,
                agentsFailed: 0,
                searchResultsCount: params.searchResults.length,
                analysisResultsCount: 0,
                extras: {
                    ...(params.coordinatorMetadata.extras ?? {}),
                    assistantMode: params.finalMode,
                    specialist: params.specialist,
                    routingReason: params.coordinatorResult.routingReason,
                },
            },
        };
    }

    private buildProgressiveResponsePayload(
        input: ResponseAgentInput,
        locale: SupportedLocale,
    ): ProgressiveResponsePayload | undefined {
        void input;
        void locale;
        return undefined;
    }

    private emitProgressiveResponse(
        callbacks: PipelineCallbacks | undefined,
        payload: ProgressiveResponsePayload | undefined,
    ): void {
        if (!payload) {
            return;
        }

        callbacks?.onProgressiveResponse?.(payload);
    }

    private createSuccessResult(
        sessionId: string,
        data: ResponseAgentOutput,
        startTime: number,
        metadata?: PipelineMetadata,
        metricsSources: ReadonlyArray<IProcessingMetrics | undefined> = [],
    ): ProcessResult<ResponseAgentOutput> {
        const aggregatedMetrics =
            this.aggregateProcessingMetrics(metricsSources);
        const metrics = buildProcessingMetrics({
            data,
            startTime,
            metadata,
            resultMetrics: aggregatedMetrics,
        });

        return {
            success: true,
            data,
            sessionId,
            timestamp: new Date().toISOString(),
            processingTimeMs: metrics.executionTime,
            metrics,
            metadata: this.sanitizeResultMetadata(metadata),
        };
    }

    private createCancelledResult(
        sessionId: string,
        startTime: number,
        metadata?: PipelineMetadata,
    ): ProcessResult<ResponseAgentOutput> {
        return {
            success: false,
            error: AI_STATUS.CANCELLED,
            sessionId,
            timestamp: new Date().toISOString(),
            processingTimeMs: Math.max(Date.now() - startTime, 0),
            metadata: this.sanitizeResultMetadata(metadata),
        };
    }

    private sanitizeResultMetadata(
        metadata?: PipelineMetadata,
    ): PipelineMetadata | undefined {
        if (!metadata) return undefined;
        const rest: PipelineMetadata = { ...metadata };
        delete rest.abortSignal;
        return rest;
    }

    private aggregateProcessingMetrics(
        metricsSources: ReadonlyArray<IProcessingMetrics | undefined>,
    ): ProcessingMetrics {
        const pricingModels = new Set<string>();
        let inputTokens = 0;
        let outputTokens = 0;
        let cachedInputTokens = 0;
        let inputCostUsd = 0;
        let outputCostUsd = 0;
        let totalCostUsd = 0;
        let llmCalls = 0;

        for (const metrics of metricsSources) {
            if (!metrics) continue;

            inputTokens += Math.max(0, toFiniteNumber(metrics.inputTokens));
            outputTokens += Math.max(0, toFiniteNumber(metrics.outputTokens));
            cachedInputTokens += Math.max(
                0,
                toFiniteNumber(metrics.cachedInputTokens),
            );
            inputCostUsd += Math.max(0, toFiniteNumber(metrics.inputCostUsd));
            outputCostUsd += Math.max(0, toFiniteNumber(metrics.outputCostUsd));
            totalCostUsd += Math.max(0, toFiniteNumber(metrics.totalCostUsd));
            llmCalls += Math.max(0, toFiniteNumber(metrics.llmCalls));

            for (const model of metrics.pricingModels ?? []) {
                if (typeof model === 'string' && model.trim()) {
                    pricingModels.add(model.trim());
                }
            }
        }

        return {
            executionTime: 0,
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
            cachedInputTokens,
            inputCostUsd,
            outputCostUsd,
            totalCostUsd:
                totalCostUsd > 0 ? totalCostUsd : inputCostUsd + outputCostUsd,
            coordinatorTime: 0,
            searchTime: 0,
            analyticsTime: 0,
            actionTime: 0,
            responseTime: 0,
            agentsInvoked: 0,
            agentsFailed: 0,
            searchResultsCount: 0,
            analysisResultsCount: 0,
            actionsExecuted: 0,
            coordinatorConfidence: 0,
            finalConfidence: AGENT_PRIORITY.LOW,
            fastPathUsed: false,
            clarificationRequired: false,
            llmCalls,
            apiCalls: 0,
            dbQueries: 0,
            pricingModels: [...pricingModels],
        };
    }

    private throwIfCancelled(sessionId: string, signal?: AbortSignal): void {
        if (!signal?.aborted) return;
        this.logger.debug(`[${sessionId}] Workflow cancelled`);
        throw ErrorUtils.createStructuredError(
            'CANCELLED',
            AI_STATUS.CANCELLED,
        );
    }

    private async raceWithAbort<T>(
        promise: Promise<T>,
        signal?: AbortSignal,
    ): Promise<T> {
        if (!signal) return promise;
        if (signal.aborted) {
            throw ErrorUtils.createStructuredError(
                'CANCELLED',
                AI_STATUS.CANCELLED,
            );
        }

        return new Promise<T>((resolve, reject) => {
            const onAbort = () => {
                cleanup();
                reject(
                    ErrorUtils.createStructuredError(
                        'CANCELLED',
                        AI_STATUS.CANCELLED,
                    ),
                );
            };

            const cleanup = () => {
                signal.removeEventListener('abort', onAbort);
            };

            signal.addEventListener('abort', onAbort, { once: true });

            promise.then(
                (value) => {
                    cleanup();
                    resolve(value);
                },
                (error) => {
                    cleanup();
                    reject(
                        error instanceof Error
                            ? error
                            : ErrorUtils.createStructuredError(
                                  'UNHANDLED_REJECTION',
                                  String(error ?? 'Unknown error'),
                              ),
                    );
                },
            );
        });
    }
}
