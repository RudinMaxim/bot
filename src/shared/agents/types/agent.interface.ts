/**
 * Базовые типы и интерфейсы для системы агентов
 * @module agents/common
 */

/**
 * Базовый интерфейс конфигурации агента
 */
export interface IAgentConfig {
    readonly name: string;
    readonly version?: string;
    readonly enabled?: boolean;
}

export interface IProcessingMetrics {
    executionTime: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    llmCalls?: number;
    retryCount?: number;
    searchAgentUsed?: boolean;
    searchDocumentsCount?: number;
    fallbackUsed?: boolean;
    fallbackReasons?: string[];
    cachedInputTokens?: number;
    inputCostUsd?: number;
    outputCostUsd?: number;
    totalCostUsd?: number;
    pricingModels?: string[];
    modelBreakdown?: IModelUsageMetrics[];
}

export interface IModelUsageMetrics {
    model: string;
    llmCalls: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cachedInputTokens: number;
    inputCostUsd: number;
    outputCostUsd: number;
    totalCostUsd: number;
}

/**
 * Конфигурация для LLM агента
 */
export interface ILLMAgentConfig extends IAgentConfig {
    readonly llm: {
        readonly apiKey: string;
        readonly baseUrl?: string;
        readonly modelName: string;
        readonly temperature: number;
        readonly maxTokens: number;
        readonly topP?: number;
        readonly maxRetries?: number;
        readonly streamingEnabled?: boolean;
    };
}

/**
 * Опции для парсинга JSON ответов
 */
export interface JsonParseOptions {
    readonly strict?: boolean;
    readonly fallbackValue?: unknown;
    readonly maxLength?: number;
}

/**
 * Базовый интерфейс входных данных агента
 */
export interface IAgentInput {
    readonly sessionId: string;
    readonly timestamp: string;
    readonly metadata?: Record<string, unknown>;
}

/**
 * Базовый интерфейс выходных данных агента
 */
export interface IAgentOutput {
    readonly sessionId: string;
    readonly timestamp: string;
    readonly success: boolean;
    readonly metrics: IProcessingMetrics;
    readonly error?: string;
}

/**
 * Результат валидации входных данных
 */
export interface ValidationResult {
    readonly valid: boolean;
    readonly errors: string[];
}

/**
 * Контекст выполнения агента
 */
export interface AgentExecutionContext {
    readonly startTime: number;
    readonly sessionId: string;
    readonly traceId?: string;
    readonly abortSignal?: AbortSignal;
    inputTokens: number;
    outputTokens: number;
    llmCalls: number;
    retryCount: number;
    cachedInputTokens: number;
    inputCostUsd: number;
    outputCostUsd: number;
    totalCostUsd: number;
    pricingModels: string[];
    modelBreakdown: Record<string, IModelUsageMetrics>;
}

/**
 * Основной интерфейс агента
 * @template TInput - тип входных данных
 * @template TOutput - тип выходных данных
 */
export interface IAgent<
    TInput extends IAgentInput,
    TOutput extends IAgentOutput,
> {
    /**
     * Основной метод обработки запроса агентом
     */
    process(input: TInput): Promise<TOutput>;

    /**
     * Валидация входных данных
     */
    validateInput(input: TInput): ValidationResult;

    /**
     * Получение текущей конфигурации (read-only)
     */
    getConfig(): Readonly<IAgentConfig>;

    /**
     * Проверка готовности агента к работе
     */
    isReady(): boolean;
}

/**
 * Интерфейс для агентов с поддержкой токенов
 */
export interface ITokenAwareAgent {
    /**
     * Оценка количества токенов в тексте
     */
    estimateTokens(text: string): number;

    /**
     * Получение статистики использования токенов
     */
    getTokenUsage(): {
        totalInputTokens: number;
        totalOutputTokens: number;
        totalTokens: number;
    };
}

/**
 * Интерфейс для агентов с LLM
 */
export interface ILLMAgent {
    /**
     * Название используемой модели
     */
    readonly modelName: string;

    /**
     * Проверка доступности модели
     */
    checkModelAvailability(): Promise<boolean>;
}

/**
 * Опции для создания агента
 */
export interface AgentOptions {
    readonly enableMetrics?: boolean;
    readonly enableLogging?: boolean;
    readonly maxRetries?: number;
    readonly timeout?: number;
}

/**
 * Унифицированные типы агентов и задач
 */
export type AgentName =
    | 'action_agent'
    | 'search_agent'
    | 'apartment_selection_agent'
    | 'analyzing_agent'
    | 'site_assistant_agent'
    | 'coordinator_agent'
    | 'response_agent';

export const AGENT_PRIORITY = {
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
} as const;

export type AgentPriority =
    (typeof AGENT_PRIORITY)[keyof typeof AGENT_PRIORITY];

export interface AgentTask {
    instruction: string;
    parameters?: Record<string, unknown>;
}

export interface AssignedAgent {
    agent_name: AgentName;
    priority: AgentPriority;
    tasks: AgentTask[];
}
