import { ChatOpenAI } from '@langchain/openai';
import {
    SystemMessage,
    HumanMessage,
    BaseMessage,
} from '@langchain/core/messages';
import type { RunnableConfig } from '@langchain/core/runnables';
import { BaseAgent } from './base.agent';
import {
    IAgentInput,
    IAgentOutput,
    ILLMAgent,
    AgentExecutionContext,
    ILLMAgentConfig,
    AgentOptions,
    JsonParseOptions,
    type IProcessingMetrics,
} from '../types';
import { ErrorUtils, buildLlmResponseMetrics } from '../utils';

interface InvokeLLMOptions {
    readonly onChunk?: (chunk: string) => void;
}

/**
 * Базовый класс для агентов с поддержкой LLM
 * Расширяет BaseAgent добавляя функциональность для работы с языковыми моделями
 * @template TInput - тип входных данных
 * @template TOutput - тип выходных данных
 * @template ILLMAgentConfig - тип конфигурации агента
 * @module agents/common
 */
export abstract class BaseLLMAgent<
        TInput extends IAgentInput,
        TOutput extends IAgentOutput,
        TConfig extends ILLMAgentConfig,
    >
    extends BaseAgent<TInput, TOutput, TConfig>
    implements ILLMAgent
{
    protected model!: ChatOpenAI;
    private cachedSystemMessage: SystemMessage | undefined;

    constructor(agentName: string, options: AgentOptions = {}) {
        super(agentName, options);
    }

    /**
     * Название используемой модели
     */
    get modelName(): string {
        return this.config.llm.modelName;
    }

    onModuleInit() {
        super.onModuleInit();
        this.model = this.initializeModel();
    }

    /**
     * Инициализация LLM модели
     */
    protected initializeModel(): ChatOpenAI {
        try {
            const model = new ChatOpenAI({
                apiKey: this.config.llm.apiKey,
                configuration: this.config.llm.baseUrl
                    ? {
                          baseURL: this.config.llm.baseUrl,
                      }
                    : undefined,
                modelName: this.config.llm.modelName,
                temperature: this.config.llm.temperature,
                maxTokens: this.config.llm.maxTokens,
                topP: this.config.llm.topP ?? 0.9,
                maxRetries: this.config.llm.maxRetries ?? 3,
                streaming: this.config.llm.streamingEnabled ?? false,
            });
            model.getNumTokens = async (content) =>
                this.estimateTokens(this.formatMessageContent(content));
            Object.assign(model, {
                getNumTokensFromMessages: async (messages: BaseMessage[]) => ({
                    totalCount: 0,
                    countPerMessage: messages.map(() => 0),
                }),
                _getEstimatedTokenCountFromPrompt: async () => 0,
                _getNumTokensFromGenerations: async () => 0,
            });

            this.logger.log(
                `LLM model initialized: ${this.config.llm.modelName} | ` +
                    `temperature=${this.config.llm.temperature} | ` +
                    `maxTokens=${this.config.llm.maxTokens}`,
            );

            return model;
        } catch (error) {
            this.logger.error(
                'Failed to initialize LLM model',
                ErrorUtils.extractStackTrace(error),
            );
            throw ErrorUtils.createStructuredError(
                'LLM_INIT_ERROR',
                'Failed to initialize LLM model',
                { error: ErrorUtils.extractErrorMessage(error) },
            );
        }
    }

    /**
     * Валидация конфигурации LLM
     */
    protected validateConfig(config: TConfig): void {
        super.validateConfig(config);

        if (!config.llm) {
            throw new Error('LLM configuration is required');
        }

        if (!config.llm.apiKey || config.llm.apiKey.trim().length === 0) {
            throw new Error('LLM API key is required and cannot be empty');
        }

        if (config.llm.baseUrl && config.llm.baseUrl.trim().length === 0) {
            throw new Error('LLM base URL cannot be empty');
        }

        if (!config.llm.modelName || config.llm.modelName.trim().length === 0) {
            throw new Error('LLM model name is required and cannot be empty');
        }

        if (config.llm.temperature < 0 || config.llm.temperature > 2) {
            throw new Error('Temperature must be between 0 and 2');
        }

        if (config.llm.maxTokens <= 0) {
            throw new Error('Max tokens must be greater than 0');
        }
    }

    /**
     * Проверка доступности модели
     */
    async checkModelAvailability(): Promise<boolean> {
        try {
            const testMessage = new HumanMessage('test');
            await this.model.invoke([testMessage]);
            return true;
        } catch (error) {
            this.logger.error(
                'Model availability check failed',
                ErrorUtils.extractStackTrace(error),
            );
            return false;
        }
    }

    /**
     * Готовность агента включает проверку модели
     */
    isReady(): boolean {
        return super.isReady() && !!this.model;
    }

    /**
     * Вызов LLM с автоматической обработкой токенов
     */
    protected async invokeLLM(
        messages: BaseMessage[],
        context: AgentExecutionContext,
        options?: InvokeLLMOptions,
    ): Promise<string> {
        this.validateMessages(messages);

        const inputText = messages
            .map((m) => this.formatMessageContent(m.content))
            .join('\n---\n');
        const inputTokens = this.estimateTokens(inputText);

        try {
            const invokeConfig: Partial<RunnableConfig> | undefined =
                context.abortSignal
                    ? { signal: context.abortSignal }
                    : undefined;
            const response = await this.model.invoke(messages, invokeConfig);
            if (context.abortSignal?.aborted) {
                throw ErrorUtils.createStructuredError(
                    'CANCELLED',
                    'cancelled',
                );
            }

            if (!response.content || typeof response.content !== 'string') {
                throw ErrorUtils.createStructuredError(
                    'INVALID_LLM_RESPONSE',
                    'Invalid response content from LLM',
                    { responseType: typeof response.content },
                );
            }

            options?.onChunk?.(response.content);

            const outputTokens = this.estimateTokens(response.content);
            const metrics = this.buildLLMMetrics(
                response,
                inputTokens,
                outputTokens,
            );
            this.updateTokenMetrics(
                context,
                metrics.inputTokens,
                metrics.outputTokens,
                {
                    llmCalls: metrics.llmCalls,
                    cachedInputTokens: metrics.cachedInputTokens,
                    inputCostUsd: metrics.inputCostUsd,
                    outputCostUsd: metrics.outputCostUsd,
                    totalCostUsd: metrics.totalCostUsd,
                    pricingModel: metrics.pricingModels?.[0],
                },
            );

            return response.content;
        } catch (error) {
            if (this.isRateLimitError(error)) {
                this.logger.warn(
                    `Rate limit encountered for session ${context.sessionId}, will retry with backoff`,
                );
            }

            this.logger.error(
                'LLM invocation failed',
                ErrorUtils.extractStackTrace(error),
            );
            throw error;
        }
    }

    /**
     * Создание системного промпта (должен быть реализован)
     */
    protected abstract getSystemPrompt(): string;

    /**
     * Валидация промпта перед отправкой
     */
    protected validatePrompt(prompt: string): void {
        if (!prompt || prompt.trim().length === 0) {
            throw ErrorUtils.createStructuredError(
                'INVALID_PROMPT',
                'Prompt cannot be empty',
            );
        }

        const estimatedTokens = this.estimateTokens(prompt);
        if (estimatedTokens > this.config.llm.maxTokens * 0.8) {
            this.logger.warn(
                `Prompt is very long (${estimatedTokens} tokens), may exceed context window`,
            );
        }
    }

    /**
     * Безопасно приводит контент к строке.
     */
    protected formatMessageContent(content: unknown): string {
        if (typeof content === 'string') {
            return content.trim();
        }

        if (typeof content === 'number' || typeof content === 'boolean') {
            return String(content);
        }

        if (Array.isArray(content)) {
            return content
                .map((item) => this.formatMessageContent(item))
                .join('\n');
        }

        if (content && typeof content === 'object') {
            try {
                return JSON.stringify(content, null, 2);
            } catch (err) {
                this.logger?.warn?.('Failed to stringify message content', err);
                return '[Unserializable object]';
            }
        }

        if (content === null || content === undefined) {
            return '[empty]';
        }

        try {
            return JSON.stringify(content);
        } catch {
            return '[unknown content]';
        }
    }

    /**
     * Валидация сообщений
     */
    protected validateMessages(messages: BaseMessage[]): void {
        if (!messages || messages.length === 0) {
            throw ErrorUtils.createStructuredError(
                'INVALID_MESSAGES',
                'Messages array cannot be empty',
            );
        }

        for (const message of messages) {
            if (!message.content) {
                throw ErrorUtils.createStructuredError(
                    'INVALID_MESSAGE_CONTENT',
                    'Message content cannot be empty',
                );
            }
        }
    }

    /**
     * Построение сообщений для LLM
     */
    protected buildMessages(userPrompt: string): BaseMessage[] {
        this.validatePrompt(userPrompt);

        if (!this.cachedSystemMessage) {
            this.cachedSystemMessage = new SystemMessage(
                this.getSystemPrompt(),
            );
        }

        return [this.cachedSystemMessage, new HumanMessage(userPrompt)];
    }

    /**
     * Очистка JSON ответа от markdown блоков
     */
    protected cleanJsonResponse(responseContent: string): string {
        let cleaned = responseContent.trim();

        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
        cleaned = cleaned.replace(/^```\s*/i, '');
        cleaned = cleaned.replace(/\s*```$/i, '');

        return cleaned.trim();
    }

    private extractLikelyJsonPayload(text: string): string {
        const trimmed = text.trim();
        if (!trimmed) return trimmed;

        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            return trimmed;
        }

        const firstBrace = trimmed.indexOf('{');
        const lastBrace = trimmed.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            return trimmed.slice(firstBrace, lastBrace + 1).trim();
        }

        const firstBracket = trimmed.indexOf('[');
        const lastBracket = trimmed.lastIndexOf(']');
        if (
            firstBracket !== -1 &&
            lastBracket !== -1 &&
            lastBracket > firstBracket
        ) {
            return trimmed.slice(firstBracket, lastBracket + 1).trim();
        }

        return trimmed;
    }

    private escapeInvalidControlCharsInJsonStrings(json: string): string {
        let inString = false;
        let isEscaped = false;
        let result = '';

        for (let i = 0; i < json.length; i++) {
            const ch = json[i];

            if (!inString) {
                if (ch === '"') {
                    inString = true;
                }
                result += ch;
                continue;
            }

            if (isEscaped) {
                result += ch;
                isEscaped = false;
                continue;
            }

            if (ch === '\\') {
                result += ch;
                isEscaped = true;
                continue;
            }

            if (ch === '"') {
                inString = false;
                result += ch;
                continue;
            }

            if (ch === '\n') {
                result += '\\n';
                continue;
            }

            if (ch === '\r') {
                result += '\\n';
                continue;
            }

            if (ch === '\t') {
                result += '\\t';
                continue;
            }

            if (ch === '\f') {
                result += '\\f';
                continue;
            }

            if (ch === '\b') {
                result += '\\b';
                continue;
            }

            const code = ch.charCodeAt(0);
            if (code >= 0 && code < 0x20) {
                result += `\\u${code.toString(16).padStart(4, '0')}`;
                continue;
            }

            result += ch;
        }

        return result;
    }

    /**
     * Парсинг JSON ответа с обработкой ошибок
     */
    protected parseJsonResponse<T>(
        responseContent: string,
        options: JsonParseOptions = {},
    ): T {
        const { strict = true, fallbackValue, maxLength } = options;

        try {
            const cleaned = this.extractLikelyJsonPayload(
                this.cleanJsonResponse(responseContent),
            );

            if (maxLength && cleaned.length > maxLength) {
                throw new Error(
                    `Response exceeds max length: ${cleaned.length} > ${maxLength}`,
                );
            }

            try {
                return JSON.parse(cleaned) as T;
            } catch (parseError) {
                const repaired =
                    this.escapeInvalidControlCharsInJsonStrings(cleaned);

                if (repaired !== cleaned) {
                    return JSON.parse(repaired) as T;
                }

                throw parseError;
            }
        } catch (error) {
            const truncatedContent = responseContent.substring(0, 200);

            this.logger.error(
                `Failed to parse JSON response: ${ErrorUtils.extractErrorMessage(error)} | ` +
                    `Content preview: ${truncatedContent}...`,
            );

            if (!strict && fallbackValue !== undefined) {
                this.logger.warn('Using fallback value due to parse error');
                return fallbackValue as T;
            }

            throw ErrorUtils.createStructuredError(
                'JSON_PARSE_ERROR',
                'Invalid JSON response from LLM',
                {
                    error: ErrorUtils.extractErrorMessage(error),
                    preview: truncatedContent,
                },
            );
        }
    }

    /**
     * Retry для LLM вызовов с экспоненциальной задержкой
     */
    protected async invokeLLMWithRetry(
        messages: BaseMessage[],
        context: AgentExecutionContext,
        retries: number = 3,
        options?: InvokeLLMOptions,
    ): Promise<string> {
        return this.withRetry(
            () => this.invokeLLM(messages, context, options),
            retries,
            1000,
            {
                signal: context.abortSignal,
                onRetry: () => {
                    context.retryCount += 1;
                },
            },
        );
    }

    /**
     * Проверка на rate limit ошибку
     */
    protected isRateLimitError(error: unknown): boolean {
        const message = ErrorUtils.extractErrorMessage(error).toLowerCase();
        return (
            message.includes('rate limit') ||
            message.includes('too many requests') ||
            message.includes('429')
        );
    }

    private buildLLMMetrics(
        response: unknown,
        fallbackInputTokens: number,
        fallbackOutputTokens: number,
    ): IProcessingMetrics {
        const metrics = buildLlmResponseMetrics({
            response,
            fallbackInputTokens,
            fallbackOutputTokens,
            defaultModelName: this.modelName,
        });

        return {
            executionTime: 0,
            inputTokens: metrics.inputTokens,
            outputTokens: metrics.outputTokens,
            totalTokens: metrics.totalTokens,
            llmCalls: 1,
            cachedInputTokens: metrics.cachedInputTokens,
            inputCostUsd: metrics.inputCostUsd,
            outputCostUsd: metrics.outputCostUsd,
            totalCostUsd: metrics.totalCostUsd,
            pricingModels: metrics.pricingModel ? [metrics.pricingModel] : [],
        };
    }

    /**
     * Graceful shutdown
     */
    async shutdown(): Promise<void> {
        await super.shutdown();
    }
}
