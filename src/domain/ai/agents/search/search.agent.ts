import { Injectable } from '@nestjs/common';
import {
    BaseAgent,
    AgentExecutionContext,
    ValidationUtils,
    ErrorUtils,
} from 'src/shared/agents';
import { SecretsConfig } from 'src/infrastructure/config';
import { AGENT_NAME } from '../../common/constants';
import {
    SearchAgentInput,
    SearchAgentResponse,
    SearchAgentConfig,
    SearchResult as AgentSearchResult,
    SearchAnswerability,
    SearchCoverage,
    VectorSearchParams,
    WeaviateDocument,
} from './common/types/search.types';
import { EmbeddingService } from 'src/domain/search-base';
import type {
    SearchResult as EmbeddingSearchResult,
} from 'src/domain/search-base/common/types/embedding.service.interface';

@Injectable()
export class SearchAgentService extends BaseAgent<
    SearchAgentInput,
    SearchAgentResponse,
    SearchAgentConfig
> {
    private static readonly HYBRID_QUERY_PROPERTIES = [
        'title',
        'description',
        'content',
        'text',
    ];

    constructor(
        private readonly embeddingService: EmbeddingService,
        private readonly secretsConfig: SecretsConfig,
    ) {
        super(AGENT_NAME.SEARCH);
    }

    protected loadConfiguration(): SearchAgentConfig {
        return {
            name: AGENT_NAME.SEARCH,
            version: '1.0.0',
            enabled: true,
            search: {
                defaultLimit: this.secretsConfig.embedding.searchDefaultLimit,
                maxLimit: this.secretsConfig.embedding.searchMaxLimit,
                minSimilarity:
                    this.secretsConfig.embedding.searchDefaultThreshold,
                hybridAlpha: this.normalizeHybridAlpha(
                    this.secretsConfig.embedding.searchHybridAlpha,
                ),
            },
        };
    }

    validateInput(input: SearchAgentInput): {
        valid: boolean;
        errors: string[];
    } {
        const errors = [
            ...ValidationUtils.validateSessionId(input.sessionId),
            ...ValidationUtils.validateTimestamp(input.timestamp),
        ];

        if (!input.agents?.length) {
            errors.push('No agent assignments found');
        }

        for (const agent of input.agents) {
            if (!agent.tasks?.length) {
                errors.push('Agent must have at least one task');
            }
        }

        return { valid: errors.length === 0, errors };
    }

    protected async processInternal(
        input: SearchAgentInput,
        context: AgentExecutionContext,
    ): Promise<SearchAgentResponse> {
        const tasks = input.agents.flatMap((a) => a.tasks);

        const searchResults = await Promise.all(
            tasks.map((task) =>
                this.processSearchTask(input.sessionId, task, context).catch(
                    (error) => {
                        if (
                            context.abortSignal?.aborted ||
                            ErrorUtils.isCancellationError(error)
                        ) {
                            throw error;
                        }
                        return this.createFallbackResult(
                            task.instruction,
                            error,
                            input.sessionId,
                        );
                    },
                ),
            ),
        );
        const searchDocumentsCount = searchResults.reduce(
            (sum, result) => sum + result.results.length,
            0,
        );
        const fallbackUsed = searchResults.some((result) =>
            result.results.some(
                (document) =>
                    document.metadata?.fallback === true ||
                    document.metadata?.source === 'fallback',
            ),
        );
        const metrics = this.createMetrics(context);
        metrics.searchAgentUsed = true;
        metrics.searchDocumentsCount = searchDocumentsCount;
        metrics.fallbackUsed = fallbackUsed;

        return {
            sessionId: input.sessionId,
            timestamp: new Date().toISOString(),
            searchResults,
            metrics,
            success: true,
        };
    }

    protected createErrorResponse(
        input: SearchAgentInput,
        errorMessage: string,
        executionTime: number,
    ): SearchAgentResponse {
        return {
            sessionId: input.sessionId,
            timestamp: new Date().toISOString(),
            searchResults: [],
            metrics: {
                executionTime,
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
                searchAgentUsed: true,
                searchDocumentsCount: 0,
            },
            success: false,
            error: errorMessage,
        };
    }

    private async processSearchTask(
        sessionId: string,
        task: { instruction: string; parameters?: Record<string, unknown> },
        context: AgentExecutionContext,
    ): Promise<AgentSearchResult> {
        const startTime = Date.now();
        const params = this.buildSearchParams(
            task.instruction,
            task.parameters,
        );

        this.logger.debug(
            `[${sessionId}] ${params.strategy} search: semantic="${params.query}" keyword="${params.keywordQuery}" (limit: ${params.limit}, threshold: ${params.similarity})`,
        );

        const vectorResults = await this.searchWithTimeout(params, context);
        const retrievalTime = Date.now() - startTime;

        this.logger.debug(
            `[${sessionId}] ${params.strategy} retrieval completed in ${retrievalTime}ms with ${vectorResults.length} raw results`,
        );

        const documents = this.transformVectorResults(
            vectorResults,
            params.similarity,
            params.query,
            params.strategy,
        );
        const answerability = this.determineAnswerability(
            documents,
            vectorResults,
        );
        const coverage = this.determineCoverage(documents, answerability);
        const summary = this.summarizeDocuments(
            documents,
            answerability,
            params.query,
        );
        const topSimilarity = this.getTopSimilarity(vectorResults);

        return {
            taskId: this.generateTaskId(),
            query: params.query,
            results: documents,
            summarizedResponse: summary,
            metadata: {
                totalResults: documents.length,
                similarity: params.similarity,
                executionTime: Date.now() - startTime,
                strategy: params.strategy,
                answerability,
                coverage,
                rawResults: vectorResults.length,
                topSimilarity,
            },
        };
    }

    private async searchWithTimeout(
        params: VectorSearchParams,
        context: AgentExecutionContext,
    ): Promise<EmbeddingSearchResult[]> {
        const controller = new AbortController();
        const timeoutMs = this.options.timeout;
        const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
        const parentSignal = context.abortSignal;
        const onAbort = () => controller.abort();

        if (parentSignal) {
            if (parentSignal.aborted) {
                clearTimeout(timeoutHandle);
                throw ErrorUtils.createStructuredError(
                    'CANCELLED',
                    'cancelled',
                );
            }
            parentSignal.addEventListener('abort', onAbort, { once: true });
        }

        try {
            return await this.embeddingService.searchSimilar(params.query, {
                limit: params.limit,
                threshold: 0,
                filters: params.filters,
                strategy: params.strategy,
                hybridAlpha: params.hybridAlpha,
                hybridQuery: params.keywordQuery,
                queryProperties: params.queryProperties,
                signal: controller.signal,
            });
        } catch (error) {
            if (
                parentSignal?.aborted ||
                ErrorUtils.isCancellationError(error)
            ) {
                throw error;
            }

            if (controller.signal.aborted) {
                throw ErrorUtils.createStructuredError(
                    'TIMEOUT',
                    `Operation timeout after ${timeoutMs}ms`,
                    { timeout: timeoutMs },
                );
            }

            throw error;
        } finally {
            clearTimeout(timeoutHandle);
            if (parentSignal) {
                parentSignal.removeEventListener('abort', onAbort);
            }
        }
    }

    private buildSearchParams(
        instruction: string,
        parameters?: Record<string, unknown>,
    ): VectorSearchParams {
        const queryCandidate =
            this.readStringParam(parameters?.query) ?? instruction;
        const query = this.normalizeKnowledgeQuery(queryCandidate);
        const keywordQuery = this.normalizeKeywordQuery(queryCandidate);
        if (!query) {
            throw new Error('Search query is required');
        }

        const limit = this.normalizeLimit(parameters?.limit);
        const similarity = this.normalizeSimilarity(parameters?.similarity);

        return {
            query,
            keywordQuery: keywordQuery || query,
            limit,
            similarity,
            strategy: 'hybrid',
            hybridAlpha: this.config.search.hybridAlpha,
            queryProperties: [...SearchAgentService.HYBRID_QUERY_PROPERTIES],
        };
    }

    private normalizeKnowledgeQuery(query: string): string {
        const trimmed = query.trim().replace(/\s+/g, ' ');
        if (!trimmed) {
            return '';
        }

        const expandedAbbreviations = trimmed
            .replace(/(^|[\s(])жк\.?(?=$|[\s,.;:!?)])/giu, '$1жилой комплекс')
            .replace(/(^|[\s(])р-?не(?=$|[\s,.;:!?)])/giu, '$1районе')
            .replace(/(^|[\s(])р-?на(?=$|[\s,.;:!?)])/giu, '$1района')
            .replace(/(^|[\s(])р-?ну(?=$|[\s,.;:!?)])/giu, '$1району')
            .replace(/(^|[\s(])р-?ном(?=$|[\s,.;:!?)])/giu, '$1районом')
            .replace(/(^|[\s(])р-?н\.?(?=$|[\s,.;:!?)])/giu, '$1район')
            .replace(/(^|[\s(])ул\.?(?=$|[\s,.;:!?)])/giu, '$1улица');

        const variants = [trimmed];
        if (
            expandedAbbreviations.toLowerCase() !== trimmed.toLowerCase()
        ) {
            variants.push(expandedAbbreviations);
        }

        if (this.matchesInitialPaymentAlias(trimmed)) {
            variants.push(
                `${trimmed} первоначальный взнос первый взнос первый платеж`,
            );
        }

        const uniqueVariants = variants.filter(
            (value, index) =>
                variants.findIndex(
                    (candidate) =>
                        candidate.toLowerCase() === value.toLowerCase(),
                ) === index,
        );

        if (uniqueVariants.length === 1) {
            return trimmed;
        }

        return uniqueVariants.join('\n');
    }

    private matchesInitialPaymentAlias(query: string): boolean {
        return (
            /\bперв(?:оначальн\w*|ый|ого|ому|ым|ом)\s+взнос\w*/iu.test(
                query,
            ) ||
            /\bперв(?:ый|ого|ому|ым|ом)\s+плат[её]ж\w*/iu.test(query) ||
            /\bстарт\w*\s+взнос\w*/iu.test(query) ||
            /\bминимальн\w*\s+взнос\w*/iu.test(query) ||
            /сколько\s+нужно\s+внести\s+сначала/iu.test(query) ||
            /\bчто\s+по\s+первому\s+взносу\b/iu.test(query)
        );
    }

    private normalizeKeywordQuery(query: string): string {
        return query.trim().replace(/\s+/g, ' ');
    }

    private transformVectorResults(
        results: EmbeddingSearchResult[],
        similarityThreshold: number,
        query: string,
        strategy?: VectorSearchParams['strategy'],
    ): WeaviateDocument[] {
        const threshold =
            strategy === 'hybrid'
                ? 0
                : Math.max(
                      this.config.search.minSimilarity,
                      similarityThreshold,
                  );

        return this.rankStructuredMatches(results, query, threshold)
            .map((r) => ({
                _additional: {
                    id: r.id,
                    certainty: r.similarity,
                    distance: 1 - r.similarity,
                },
                content: r.text,
                url: typeof r.source === 'string' ? r.source : undefined,
                metadata: {
                    source: typeof r.source === 'string' ? r.source : undefined,
                    blobType:
                        this.readStringParam(r.metadata?.blobType) ??
                        'document',
                    certainty: r.similarity,
                    distance: 1 - r.similarity,
                },
            }));
    }

    private rankStructuredMatches(
        results: ReadonlyArray<EmbeddingSearchResult>,
        query: string,
        threshold: number,
    ): EmbeddingSearchResult[] {
        return results
            .map((result) => ({
                result,
                structuredScore: this.calculateStructuredScore(
                    result.text,
                    query,
                ),
            }))
            .filter(
                ({ result, structuredScore }) =>
                    result.similarity >= threshold || structuredScore >= 4,
            )
            .sort((left, right) => {
                if (right.structuredScore !== left.structuredScore) {
                    return right.structuredScore - left.structuredScore;
                }

                return right.result.similarity - left.result.similarity;
            })
            .map(({ result }) => result);
    }

    private calculateStructuredScore(text: string, query: string): number {
        const structured = this.extractStructuredFields(text);
        if (!structured) {
            return 0;
        }

        const queryTokens = this.tokenize(query);
        if (queryTokens.length === 0) {
            return 0;
        }

        const phraseScore = structured.searchPhrases.reduce(
            (max, phrase) =>
                Math.max(max, this.countTokenOverlap(queryTokens, phrase) * 2),
            0,
        );
        const titleScore = this.countTokenOverlap(queryTokens, structured.title);
        const answerScore = this.countTokenOverlap(queryTokens, structured.answer);

        return phraseScore + titleScore + answerScore;
    }

    private extractStructuredFields(text: string): {
        title: string;
        searchPhrases: string[];
        answer: string;
    } | null {
        if (!text.includes('queries:') && !text.includes('answer:')) {
            return null;
        }

        const lines = text
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0);

        const title =
            lines
                .find((line) => line.toLowerCase().startsWith('title:'))
                ?.slice('title:'.length)
                .trim() || '';
        const searchPhrases =
            lines
                .find((line) =>
                    line.toLowerCase().startsWith('queries:'),
                )
                ?.slice('queries:'.length)
                .split('|')
                .map((value) => value.trim())
                .filter((value) => value.length > 0) || [];
        const answer =
            lines
                .find((line) => line.toLowerCase().startsWith('answer:'))
                ?.slice('answer:'.length)
                .trim() || '';

        return {
            title,
            searchPhrases,
            answer,
        };
    }

    private tokenize(value: string): string[] {
        return value
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
            .split(/\s+/)
            .map((token) => token.trim())
            .filter((token) => token.length >= 3);
    }

    private countTokenOverlap(queryTokens: string[], candidate: string): number {
        if (!candidate.trim()) {
            return 0;
        }

        const candidateTokens = new Set(this.tokenize(candidate));
        let overlap = 0;
        for (const token of queryTokens) {
            if (candidateTokens.has(token)) {
                overlap += 1;
            }
        }

        return overlap;
    }

    private determineAnswerability(
        docs: ReadonlyArray<WeaviateDocument>,
        rawResults: ReadonlyArray<EmbeddingSearchResult>,
    ): SearchAnswerability {
        if (docs.length > 0) {
            return 'answerable';
        }

        return rawResults.length > 0
            ? 'insufficient_evidence'
            : 'insufficient_evidence';
    }

    private summarizeDocuments(
        docs: ReadonlyArray<WeaviateDocument>,
        answerability: SearchAnswerability,
        query: string,
    ): string {
        if (docs.length > 0) {
            return docs.map((d) => d.content).join('\n\n');
        }

        if (answerability === 'insufficient_evidence') {
            return `В базе знаний ЖК «Мыс» нет достоверной информации для ответа на вопрос: "${query}".`;
        }

        return 'No relevant results found.';
    }

    private determineCoverage(
        docs: ReadonlyArray<WeaviateDocument>,
        answerability: SearchAnswerability,
    ): SearchCoverage {
        if (answerability !== 'answerable' || docs.length === 0) {
            return 'none';
        }

        const hasPartialHint = docs.some((doc) => {
            const content = doc.content?.toLowerCase() ?? '';
            return (
                content.includes('coverage_hint: partial') ||
                content.includes('coverage: partial')
            );
        });

        return hasPartialHint ? 'partial' : 'full';
    }

    private getTopSimilarity(
        results: ReadonlyArray<EmbeddingSearchResult>,
    ): number {
        if (results.length === 0) {
            return 0;
        }

        return results.reduce(
            (max, item) =>
                item.similarity > max ? item.similarity : max,
            0,
        );
    }

    private readStringParam(value: unknown): string | undefined {
        return typeof value === 'string' ? value : undefined;
    }

    private readNumberParam(value: unknown, fallback: number): number {
        return typeof value === 'number' && Number.isFinite(value)
            ? value
            : fallback;
    }

    private normalizeLimit(value: unknown): number {
        const parsed = Math.floor(
            this.readNumberParam(value, this.config.search.defaultLimit),
        );
        if (!Number.isFinite(parsed) || parsed < 1) {
            return this.config.search.defaultLimit;
        }

        return Math.min(parsed, this.config.search.maxLimit);
    }

    private normalizeSimilarity(value: unknown): number {
        const parsed = this.readNumberParam(
            value,
            this.config.search.minSimilarity,
        );
        if (!Number.isFinite(parsed)) {
            return this.config.search.minSimilarity;
        }
        return Math.max(0, Math.min(1, parsed));
    }

    private normalizeHybridAlpha(value: unknown): number {
        const parsed =
            typeof value === 'number' && Number.isFinite(value) ? value : 0.35;
        return Math.max(0, Math.min(1, parsed));
    }

    private createFallbackResult(
        query: string,
        error: unknown,
        sessionId: string,
    ): AgentSearchResult {
        const errorMsg = ErrorUtils.extractErrorMessage(error);
        this.logger.error(
            `[${sessionId}] Search failed for "${query}": ${errorMsg}`,
        );

        return {
            taskId: this.generateTaskId('fallback'),
            query,
            results: [
                {
                    _additional: {
                        id: 'fallback_result',
                        certainty: 0,
                        distance: 1,
                    },
                    title: 'Поиск временно недоступен',
                    content: `Не удалось выполнить поиск по запросу "${query}". Сервис векторного поиска недоступен.`,
                    metadata: {
                        source: 'fallback',
                        blobType: 'error',
                        fallback: true,
                        certainty: 0,
                        distance: 1,
                    },
                },
            ],
            metadata: {
                totalResults: 0,
                similarity: 0,
                executionTime: 0,
                answerability: 'unavailable',
                rawResults: 0,
                topSimilarity: 0,
            },
            error: errorMsg,
        };
    }

    private generateTaskId(prefix = 'task'): string {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    }
}
