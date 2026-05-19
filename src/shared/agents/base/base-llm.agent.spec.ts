import { BaseLLMAgent } from './base-llm.agent';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import {
    AgentExecutionContext,
    IAgentInput,
    IAgentOutput,
    ILLMAgentConfig,
} from '../types';

class TestLLMAgent extends BaseLLMAgent<
    IAgentInput,
    IAgentOutput,
    ILLMAgentConfig
> {
    protected loadConfiguration(): ILLMAgentConfig {
        return {
            name: 'test_llm_agent',
            enabled: true,
            llm: {
                apiKey: 'test-key',
                baseUrl: 'http://localhost/v1',
                modelName: 'gpt-4o',
                temperature: 0,
                maxTokens: 100,
            },
        };
    }

    protected async processInternal(
        input: IAgentInput,
        context: AgentExecutionContext,
    ): Promise<IAgentOutput> {
        return {
            sessionId: input.sessionId,
            timestamp: input.timestamp,
            success: true,
            metrics: this.createMetrics(context),
        };
    }

    protected createErrorResponse(
        input: IAgentInput,
        errorMessage: string,
        executionTime: number,
    ): IAgentOutput {
        return {
            sessionId: input.sessionId,
            timestamp: input.timestamp,
            success: false,
            error: errorMessage,
            metrics: {
                executionTime,
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
            },
        };
    }

    protected getSystemPrompt(): string {
        return 'Test system prompt';
    }

    async countWithModel(content: string): Promise<number> {
        return this.model.getNumTokens(content);
    }

    async countPromptWithModel(): Promise<number> {
        return (
            this.model as unknown as {
                _getEstimatedTokenCountFromPrompt: (
                    messages: unknown[],
                    functions?: unknown,
                    functionCall?: unknown,
                ) => Promise<number>;
            }
        )._getEstimatedTokenCountFromPrompt(
            [new HumanMessage('hello world')],
            undefined,
            undefined,
        );
    }

    async countGenerationWithModel(): Promise<number> {
        return (
            this.model as unknown as {
                _getNumTokensFromGenerations: (
                    generations: unknown[],
                ) => Promise<number>;
            }
        )._getNumTokensFromGenerations([
            { message: new AIMessage('streamed response') },
        ]);
    }

    async invokeWithChunkCallback(
        onChunk: (chunk: string) => void,
    ): Promise<string> {
        return this.invokeLLMWithRetry(
            [new HumanMessage('hello')],
            {
                sessionId: 'session_1',
                startTime: Date.now(),
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
            },
            1,
            { onChunk },
        );
    }

    replaceModel(model: unknown): void {
        this.model = model as typeof this.model;
    }

    isModelStreamingEnabled(): boolean {
        return Boolean(this.model.streaming);
    }
}

class StreamingConfiguredLLMAgent extends TestLLMAgent {
    protected loadConfiguration(): ILLMAgentConfig {
        return {
            ...super.loadConfiguration(),
            llm: {
                ...super.loadConfiguration().llm,
                streamingEnabled: true,
            },
        };
    }
}

describe('BaseLLMAgent', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    it('uses local token estimation instead of LangChain remote tiktoken fetch', async () => {
        const fetchSpy = jest
            .fn()
            .mockRejectedValue(new Error('network blocked'));
        global.fetch = fetchSpy as unknown as typeof fetch;
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
        const agent = new TestLLMAgent('test_llm_agent');

        agent.onModuleInit();

        await expect(agent.countWithModel('hello world')).resolves.toBe(4);
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(warnSpy).not.toHaveBeenCalledWith(
            expect.stringContaining('Failed to calculate number of tokens'),
            expect.anything(),
        );
    });

    it('uses local token estimation for streaming usage calculations', async () => {
        const fetchSpy = jest
            .fn()
            .mockRejectedValue(new Error('network blocked'));
        global.fetch = fetchSpy as unknown as typeof fetch;
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
        const agent = new TestLLMAgent('test_llm_agent');

        agent.onModuleInit();

        await expect(agent.countPromptWithModel()).resolves.toBe(0);
        await expect(agent.countGenerationWithModel()).resolves.toBe(0);
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(warnSpy).not.toHaveBeenCalledWith(
            expect.stringContaining('Failed to calculate number of tokens'),
            expect.anything(),
        );
    });

    it('uses invoke instead of LangChain stream when chunk callbacks are requested', async () => {
        const fetchSpy = jest
            .fn()
            .mockRejectedValue(new Error('network blocked'));
        global.fetch = fetchSpy as unknown as typeof fetch;
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
        const agent = new TestLLMAgent('test_llm_agent');

        agent.onModuleInit();

        const invoke = jest
            .fn()
            .mockResolvedValue(new AIMessage('full answer'));
        const stream = jest.fn();
        agent.replaceModel({ invoke, stream });

        const onChunk = jest.fn();
        await expect(agent.invokeWithChunkCallback(onChunk)).resolves.toBe(
            'full answer',
        );

        expect(invoke).toHaveBeenCalledTimes(1);
        expect(stream).not.toHaveBeenCalled();
        expect(onChunk).toHaveBeenCalledWith('full answer');
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(warnSpy).not.toHaveBeenCalledWith(
            expect.stringContaining('Failed to calculate number of tokens'),
            expect.anything(),
        );
    });

    it('keeps ChatOpenAI non-streaming even when response chunk callbacks are enabled', () => {
        const agent = new StreamingConfiguredLLMAgent('test_llm_agent');

        agent.onModuleInit();

        expect(agent.isModelStreamingEnabled()).toBe(false);
    });
});
