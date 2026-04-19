/**

 */

import { Logger, OnModuleInit } from '@nestjs/common';
import {
    IAgentInput,
    IAgentOutput,
    IAgentConfig,
    IAgent,
    ITokenAwareAgent,
    AgentExecutionContext,
    ValidationResult,
    IProcessingMetrics,
    AgentOptions,
} from '../types/agent.interface';
import { DateUtils, ErrorUtils, RetryUtils } from '../utils';
import { sleep } from 'src/shared/utils';

/**
 * Базовый абстрактный класс для всех агентов
 *
 * Предоставляет общую функциональность: метрики, логирование, оценку токенов
 * @template TInput - тип входных данных
 * @template TOutput - тип выходных данных
 * @template TConfig - тип конфигурации агента
 *
 * @module agents/common
 */
export abstract class BaseAgent<
        TInput extends IAgentInput,
        TOutput extends IAgentOutput,
        TConfig extends IAgentConfig,
    >
    implements IAgent<TInput, TOutput>, ITokenAwareAgent, OnModuleInit
{
    protected readonly logger: Logger;
    protected config!: TConfig;
    protected readonly options: Required<AgentOptions>;

    private tokenUsageStats = {
        totalInputTokens: 0,
        totalOutputTokens: 0,
    };

    private isShuttingDown = false;

    constructor(
        protected readonly agentName: string,
        options: AgentOptions = {},
    ) {
        this.logger = new Logger(agentName);
        this.options = {
            enableMetrics: options.enableMetrics ?? true,
            enableLogging: options.enableLogging ?? true,
            maxRetries: options.maxRetries ?? 3,
            timeout: options.timeout ?? 30000,
        };
    }

    onModuleInit() {
        try {
            this.config = this.loadConfiguration();
            this.validateConfig(this.config);

            this.logger.log(
                `${this.agentName} initialized successfully | version=${this.config.version || 'unknown'}`,
            );
        } catch (error) {
            this.logger.error(
                `Failed to initialize ${this.agentName}: ${ErrorUtils.extractErrorMessage(error)}`,
                ErrorUtils.extractStackTrace(error),
            );
            throw error;
        }
    }

    /**
     * Основной метод обработки - реализует шаблонный паттерн
     */
    async process(input: TInput): Promise<TOutput> {
        if (this.isShuttingDown) {
            throw ErrorUtils.createStructuredError(
                'AGENT_SHUTDOWN',
                'Agent is shutting down and cannot accept new requests',
                { agentName: this.agentName },
            );
        }

        const context = this.createExecutionContext(input);
        if (context.abortSignal?.aborted) {
            throw ErrorUtils.createStructuredError('CANCELLED', 'cancelled', {
                agentName: this.agentName,
            });
        }

        try {
            // Предобработка входных данных
            const preprocessedInput = this.preprocessInput(input);

            // Валидация
            const validationResult = this.validateInput(preprocessedInput);
            if (!validationResult.valid) {
                throw ErrorUtils.createStructuredError(
                    'VALIDATION_ERROR',
                    `Validation failed: ${validationResult.errors.join(', ')}`,
                    { errors: validationResult.errors },
                );
            }

            // Логирование начала
            this.logStart(context);

            // Основная обработка с таймаутом
            const result = await this.withTimeout(
                this.processInternal(preprocessedInput, context),
            );

            // Обновление метрик
            this.updateMetrics(context, result);

            // Постобработка результата
            const finalResult = this.postprocessOutput(result);

            // Логирование успеха
            this.logSuccess(context, finalResult);

            return finalResult;
        } catch (error) {
            if (
                context.abortSignal?.aborted ||
                ErrorUtils.isCancellationError(error)
            ) {
                throw ErrorUtils.createStructuredError(
                    'CANCELLED',
                    'cancelled',
                    { agentName: this.agentName },
                );
            }
            return this.handleError(error, input, context);
        }
    }

    /**
     * Абстрактный метод - основная логика обработки
     * Должен быть реализован в каждом конкретном агенте
     */
    protected abstract processInternal(
        input: TInput,
        context: AgentExecutionContext,
    ): Promise<TOutput>;

    /**
     * Абстрактный метод - загрузка конфигурации
     * Должен быть реализован в каждом конкретном агенте
     */
    protected abstract loadConfiguration(): TConfig;

    /**
     * Валидация конфигурации (может быть переопределена)
     */
    protected validateConfig(config: TConfig): void {
        if (!config.name || config.name.trim().length === 0) {
            throw new Error('Agent config must have a valid name');
        }

        if (config.enabled === false) {
            this.logger.warn(
                `Agent ${config.name} is disabled in configuration`,
            );
        }
    }

    /**
     * Предобработка входных данных (может быть переопределена)
     */
    protected preprocessInput(input: TInput): TInput {
        // По умолчанию возвращаем входные данные без изменений
        return input;
    }

    /**
     * Постобработка выходных данных (может быть переопределена)
     */
    protected postprocessOutput(output: TOutput): TOutput {
        // По умолчанию возвращаем выходные данные без изменений
        return output;
    }

    /**
     * Валидация входных данных
     */
    validateInput(input: TInput): ValidationResult {
        const errors: string[] = [];

        if (!input?.sessionId?.trim()) {
            errors.push('SessionId is required and cannot be empty');
        }

        if (!input?.timestamp) {
            errors.push('Timestamp is required');
        }

        if (input?.timestamp && !DateUtils.isValidDate(input.timestamp)) {
            errors.push('Invalid timestamp format');
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /**
     * Получение конфигурации (read-only)
     */
    getConfig(): Readonly<TConfig> {
        return { ...this.config };
    }

    /**
     * Проверка готовности агента
     */
    isReady(): boolean {
        return (
            !!this.config &&
            this.config.enabled !== false &&
            !this.isShuttingDown
        );
    }

    /**
     * Graceful shutdown
     */
    async shutdown(): Promise<void> {
        this.logger.log(`${this.agentName} initiating graceful shutdown`);
        this.isShuttingDown = true;

        await sleep(100);

        this.logger.log(`${this.agentName} shutdown completed`);
    }

    /**
     * Оценка количества токенов (простая эвристика)
     * Может быть переопределена для более точной оценки
     */
    estimateTokens(text: string): number {
        try {
            return Math.ceil(text.length / 3.5);
        } catch {
            this.logger.warn('Failed to estimate tokens');
            return 0;
        }
    }

    /**
     * Получение статистики использования токенов
     */
    getTokenUsage() {
        return {
            totalInputTokens: this.tokenUsageStats.totalInputTokens,
            totalOutputTokens: this.tokenUsageStats.totalOutputTokens,
            totalTokens:
                this.tokenUsageStats.totalInputTokens +
                this.tokenUsageStats.totalOutputTokens,
        };
    }

    /**
     * Сброс статистики токенов
     */
    resetTokenUsage(): void {
        this.tokenUsageStats.totalInputTokens = 0;
        this.tokenUsageStats.totalOutputTokens = 0;
    }

    /**
     * Создание контекста выполнения
     */
    protected createExecutionContext(input: TInput): AgentExecutionContext {
        const abortSignal = this.extractAbortSignal(input.metadata);
        return {
            startTime: Date.now(),
            sessionId: input.sessionId,
            traceId: this.generateTraceId(),
            abortSignal,
            inputTokens: 0,
            outputTokens: 0,
            llmCalls: 0,
            retryCount: 0,
            cachedInputTokens: 0,
            inputCostUsd: 0,
            outputCostUsd: 0,
            totalCostUsd: 0,
            pricingModels: [],
            modelBreakdown: {},
        };
    }

    protected extractAbortSignal(metadata: unknown): AbortSignal | undefined {
        if (!metadata || typeof metadata !== 'object') return undefined;
        const record = metadata as Record<string, unknown>;
        const candidate = record.abortSignal;
        return this.isAbortSignal(candidate) ? candidate : undefined;
    }

    private isAbortSignal(value: unknown): value is AbortSignal {
        if (!value || typeof value !== 'object') return false;
        const record = value as Record<string, unknown>;
        return (
            typeof record.aborted === 'boolean' &&
            typeof record.addEventListener === 'function'
        );
    }

    /**
     * Обновление метрик токенов
     */
    protected updateTokenMetrics(
        context: AgentExecutionContext,
        inputTokens: number,
        outputTokens: number,
        options: {
            llmCalls?: number;
            retryCount?: number;
            cachedInputTokens?: number;
            inputCostUsd?: number;
            outputCostUsd?: number;
            totalCostUsd?: number;
            pricingModel?: string;
        } = {},
    ): void {
        context.inputTokens += inputTokens;
        context.outputTokens += outputTokens;
        context.llmCalls += Math.max(0, options.llmCalls ?? 0);
        context.retryCount += Math.max(0, options.retryCount ?? 0);
        context.cachedInputTokens += Math.max(
            0,
            options.cachedInputTokens ?? 0,
        );
        context.inputCostUsd += Math.max(0, options.inputCostUsd ?? 0);
        context.outputCostUsd += Math.max(0, options.outputCostUsd ?? 0);
        context.totalCostUsd += Math.max(
            0,
            options.totalCostUsd ??
                (options.inputCostUsd ?? 0) + (options.outputCostUsd ?? 0),
        );

        if (options.pricingModel?.trim()) {
            const normalized = options.pricingModel.trim();
            if (!context.pricingModels.includes(normalized)) {
                context.pricingModels.push(normalized);
            }

            const existing = context.modelBreakdown[normalized] ?? {
                model: normalized,
                llmCalls: 0,
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
                cachedInputTokens: 0,
                inputCostUsd: 0,
                outputCostUsd: 0,
                totalCostUsd: 0,
            };

            existing.llmCalls += Math.max(0, options.llmCalls ?? 0);
            existing.inputTokens += Math.max(0, inputTokens);
            existing.outputTokens += Math.max(0, outputTokens);
            existing.totalTokens += Math.max(0, inputTokens + outputTokens);
            existing.cachedInputTokens += Math.max(
                0,
                options.cachedInputTokens ?? 0,
            );
            existing.inputCostUsd += Math.max(0, options.inputCostUsd ?? 0);
            existing.outputCostUsd += Math.max(0, options.outputCostUsd ?? 0);
            existing.totalCostUsd += Math.max(
                0,
                options.totalCostUsd ??
                    (options.inputCostUsd ?? 0) + (options.outputCostUsd ?? 0),
            );

            context.modelBreakdown[normalized] = existing;
        }

        this.tokenUsageStats.totalInputTokens += inputTokens;
        this.tokenUsageStats.totalOutputTokens += outputTokens;
    }

    /**
     * Создание объекта метрик
     */
    protected createMetrics(
        context: AgentExecutionContext,
    ): IProcessingMetrics {
        return {
            executionTime: Date.now() - context.startTime,
            inputTokens: context.inputTokens,
            outputTokens: context.outputTokens,
            totalTokens: context.inputTokens + context.outputTokens,
            llmCalls: context.llmCalls,
            retryCount: context.retryCount,
            cachedInputTokens: context.cachedInputTokens,
            inputCostUsd: context.inputCostUsd,
            outputCostUsd: context.outputCostUsd,
            totalCostUsd: context.totalCostUsd,
            pricingModels:
                context.pricingModels.length > 0
                    ? [...context.pricingModels]
                    : undefined,
            modelBreakdown:
                context.pricingModels.length > 0
                    ? Object.values(context.modelBreakdown)
                    : undefined,
        };
    }

    /**
     * Обработка ошибок
     */
    protected handleError(
        error: unknown,
        input: TInput,
        context: AgentExecutionContext,
    ): TOutput {
        const executionTime = Date.now() - context.startTime;
        const errorMessage = ErrorUtils.extractErrorMessage(error);
        const stackTrace = ErrorUtils.extractStackTrace(error);

        let errorType = 'UNKNOWN_ERROR';
        if (ErrorUtils.isTimeoutError(error)) {
            errorType = 'TIMEOUT_ERROR';
        } else if (ErrorUtils.isNetworkError(error)) {
            errorType = 'NETWORK_ERROR';
        }

        this.logger.error(
            `[${input.sessionId}] ${this.agentName} ${errorType}: ${errorMessage} | ` +
                `ExecutionTime: ${executionTime}ms | TraceId: ${context.traceId}`,
            stackTrace,
        );

        return this.createErrorResponse(input, errorMessage, executionTime);
    }

    /**
     * Абстрактный метод создания ответа при ошибке
     */
    protected abstract createErrorResponse(
        input: TInput,
        errorMessage: string,
        executionTime: number,
    ): TOutput;

    /**
     * Логирование начала обработки
     */
    protected logStart(context: AgentExecutionContext): void {
        if (!this.options.enableLogging) return;

        this.logger.log(
            `[${context.sessionId}] ${this.agentName} started | traceId=${context.traceId}`,
        );
    }

    /**
     * Логирование успешного завершения
     */
    protected logSuccess(
        context: AgentExecutionContext,
        result: TOutput,
    ): void {
        if (!this.options.enableLogging) return;

        const executionTime = Date.now() - context.startTime;
        this.logger.log(
            `[${context.sessionId}] ${this.agentName} completed in ${executionTime}ms | ` +
                `Tokens: input=${context.inputTokens}, output=${context.outputTokens}, ` +
                `total=${context.inputTokens + context.outputTokens} | ` +
                `traceId=${context.traceId} | success=${result.success}`,
        );
    }

    /**
     * Обновление метрик в результате
     */
    protected updateMetrics(
        context: AgentExecutionContext,
        result: TOutput,
    ): void {
        if (!this.options.enableMetrics) return;

        result.metrics.executionTime = Date.now() - context.startTime;
        result.metrics.inputTokens = context.inputTokens;
        result.metrics.outputTokens = context.outputTokens;
        result.metrics.totalTokens = context.inputTokens + context.outputTokens;
        result.metrics.llmCalls = context.llmCalls;
        result.metrics.retryCount = context.retryCount;
        result.metrics.cachedInputTokens = context.cachedInputTokens;
        result.metrics.inputCostUsd = context.inputCostUsd;
        result.metrics.outputCostUsd = context.outputCostUsd;
        result.metrics.totalCostUsd = context.totalCostUsd;
        result.metrics.pricingModels =
            context.pricingModels.length > 0
                ? [...context.pricingModels]
                : undefined;
        result.metrics.modelBreakdown =
            context.pricingModels.length > 0
                ? Object.values(context.modelBreakdown)
                : undefined;
    }

    /**
     * Генерация trace ID для отслеживания запросов
     */
    protected generateTraceId(): string {
        return `${this.agentName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Защищенный метод для таймаута операций
     */
    async withTimeout<T>(
        operation: Promise<T>,
        timeoutMs: number = this.options.timeout,
    ): Promise<T> {
        let timeoutHandle: NodeJS.Timeout | undefined;
        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(() => {
                reject(
                    ErrorUtils.createStructuredError(
                        'TIMEOUT',
                        `Operation timeout after ${timeoutMs}ms`,
                        { timeout: timeoutMs },
                    ),
                );
            }, timeoutMs);
        });

        try {
            return await Promise.race([operation, timeoutPromise]);
        } finally {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
        }
    }

    /**
     * Улучшенная retry логика с использованием RetryUtils
     */
    async withRetry<T>(
        operation: () => Promise<T>,
        retries: number = this.options.maxRetries,
        baseDelay: number = 1000,
        options?: { signal?: AbortSignal; onRetry?: () => void },
    ): Promise<T> {
        let lastError: unknown = null;
        const signal = options?.signal;

        for (let attempt = 0; attempt <= retries; attempt++) {
            if (signal?.aborted) {
                throw ErrorUtils.createStructuredError(
                    'CANCELLED',
                    'cancelled',
                );
            }

            try {
                return await operation();
            } catch (error) {
                lastError = error;

                if (signal?.aborted || ErrorUtils.isCancellationError(error)) {
                    throw ErrorUtils.createStructuredError(
                        'CANCELLED',
                        'cancelled',
                    );
                }

                if (!RetryUtils.shouldRetry(error, attempt, retries)) {
                    throw error;
                }

                const delay = RetryUtils.calculateBackoff(attempt, baseDelay);
                options?.onRetry?.();

                this.logger.warn(
                    `Retry attempt ${attempt + 1}/${retries} after ${delay}ms | ` +
                        `Error: ${ErrorUtils.extractErrorMessage(error)}`,
                );

                await this.sleepWithAbort(delay, signal);
            }
        }

        throw lastError;
    }

    private async sleepWithAbort(
        ms: number,
        signal?: AbortSignal,
    ): Promise<void> {
        if (!signal) {
            await sleep(ms);
            return;
        }

        if (signal.aborted) {
            throw ErrorUtils.createStructuredError('CANCELLED', 'cancelled');
        }

        await new Promise<void>((resolve, reject) => {
            const cleanup = () => signal.removeEventListener('abort', onAbort);

            const timeoutHandle = setTimeout(() => {
                cleanup();
                resolve();
            }, ms);

            const onAbort = () => {
                clearTimeout(timeoutHandle);
                reject(
                    ErrorUtils.createStructuredError('CANCELLED', 'cancelled'),
                );
            };

            signal.addEventListener('abort', onAbort, { once: true });
        });
    }
}
