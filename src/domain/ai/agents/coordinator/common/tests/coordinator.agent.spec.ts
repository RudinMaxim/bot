process.env.POSTGRES_URL =
    process.env.POSTGRES_URL ||
    'postgres://postgres:postgres@postgres:5432/app';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'redis';
process.env.OPENROUTER_API_KEY =
    process.env.OPENROUTER_API_KEY || 'sk-or-test';
process.env.MAX_BOT_TOKEN = process.env.MAX_BOT_TOKEN || 'token';
process.env.MAX_WEBHOOK_SECRET = process.env.MAX_WEBHOOK_SECRET || 'secret';

import { CoordinatorAgentService } from '../../coordinator.agent';
import { CoordinatorPreRouterService } from '../../coordinator-pre-router.service';

function createAgent() {
    const secretsConfig = {
        ai: {
            llm: {
                apiKey: 'test-key',
            },
            models: {
                coordinator: ['gpt-test'],
            },
            http: {
                timeout: 1000,
                maxRetries: 1,
            },
        },
    };

    const agent = new CoordinatorAgentService(
        secretsConfig as never,
        new CoordinatorPreRouterService(),
    );
    agent.onModuleInit();
    return agent;
}

function buildContext() {
    return {
        sessionId: 'session_1',
        traceId: 'trace_1',
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
    };
}

function buildInput(input: string) {
    return {
        sessionId: 'session_1',
        input,
        timestamp: new Date().toISOString(),
    };
}

describe('CoordinatorAgentService', () => {
    it('returns clarify mode for vague input', () => {
        const agent = createAgent();

        const result = (agent as any).parseCoordinatorResponse(
            {
                mode: 'clarify',
                clarificationQuestions: [
                    'Что именно вы хотите уточнить по аккредитации?',
                ],
                overallConfidence: 0.45,
            },
            buildInput('а как там'),
            buildContext(),
        );

        expect(result.mode).toBe('clarify');
        expect(result.clarificationQuestions).toEqual([
            'Что именно вы хотите уточнить по аккредитации?',
        ]);
    });

    it('returns route_to_specialist when the model requests routing', () => {
        const agent = createAgent();

        const result = (agent as any).parseCoordinatorResponse(
            {
                mode: 'route_to_specialist',
                routingReason: 'Нужна проверка по документам',
                overallConfidence: 0.2,
            },
            buildInput('проверьте мои документы'),
            buildContext(),
        );

        expect(result.mode).toBe('route_to_specialist');
        expect(result.routingReason).toBe('Нужна проверка по документам');
    });
});
