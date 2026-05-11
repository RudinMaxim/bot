import { BaseLLMAgent } from './base-llm.agent';
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
}

describe('BaseLLMAgent', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    it('uses local token estimation instead of LangChain remote tiktoken fetch', async () => {
        const fetchSpy = jest.fn().mockRejectedValue(new Error('network blocked'));
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
});
