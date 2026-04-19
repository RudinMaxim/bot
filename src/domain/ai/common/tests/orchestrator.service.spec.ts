process.env.POSTGRES_URL =
    process.env.POSTGRES_URL ||
    'postgres://postgres:postgres@postgres:5432/app';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'redis';
process.env.OPENROUTER_API_KEY =
    process.env.OPENROUTER_API_KEY || 'sk-or-test';
process.env.MAX_BOT_TOKEN = process.env.MAX_BOT_TOKEN || 'token';
process.env.MAX_WEBHOOK_SECRET = process.env.MAX_WEBHOOK_SECRET || 'secret';

import { AgentOrchestratorService } from '../../services/orchestrator.service';

describe('AgentOrchestratorService', () => {
    it('uses coordinator clarification when mode is clarify', () => {
        const service = new AgentOrchestratorService(
            {} as never,
            {} as never,
            {} as never,
            {} as never,
            {} as never,
            {} as never,
        );

        const result = (service as any).shouldUseCoordinatorClarification(
            'session_1',
            {
                mode: 'clarify',
                shouldClarify: true,
                clarificationQuestions: ['Уточните бюджет'],
                agents: [],
            },
        );

        expect(result).toBe(true);
    });

    it('ignores clarification when mode is answer', () => {
        const service = new AgentOrchestratorService(
            {} as never,
            {} as never,
            {} as never,
            {} as never,
            {} as never,
            {} as never,
        );

        const result = (service as any).shouldUseCoordinatorClarification(
            'session_1',
            {
                mode: 'answer',
                shouldClarify: false,
                clarificationQuestions: [],
                agents: [],
            },
        );

        expect(result).toBe(false);
    });
});
