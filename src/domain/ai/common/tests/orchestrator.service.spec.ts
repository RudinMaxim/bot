process.env.POSTGRES_URL =
    process.env.POSTGRES_URL ||
    'postgres://postgres:postgres@postgres:5432/app';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'redis';
process.env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || 'sk-or-test';
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

    it('answers conversation recall from session memory without coordinator clarification', async () => {
        const coordinatorAgent = {
            process: jest.fn().mockResolvedValue({
                success: true,
                sessionId: 'session_1',
                input: 'о чем ты мне говорил',
                timestamp: '2026-05-11T00:00:00.000Z',
                mode: 'clarify',
                agents: [],
                shouldClarify: true,
                clarificationQuestions: ['Продолжим про виды аккредитации?'],
                routingReason: undefined,
                overallConfidence: 0.4,
                metrics: {
                    executionTime: 5,
                    inputTokens: 20,
                    outputTokens: 10,
                    totalTokens: 30,
                },
            }),
        };
        const searchAgent = {
            process: jest.fn(),
        };
        const responseAgent = {
            process: jest.fn().mockResolvedValue({
                success: true,
                sessionId: 'session_1',
                timestamp: '2026-05-11T00:00:00.000Z',
                mode: 'answer',
                response:
                    'Мы обсуждали ФАЦ ПГМУ и виды аккредитации: первичную и первичную специализированную.',
                confidence: 'high',
                metrics: {
                    executionTime: 15,
                    inputTokens: 100,
                    outputTokens: 20,
                    totalTokens: 120,
                    llmCalls: 1,
                },
                metadata: {
                    executionTime: 15,
                    agentsProcessed: 1,
                    searchResultsCount: 0,
                    analysisResultsCount: 1,
                    hasUrl: false,
                    coordinatorConfidence: 0.85,
                },
            }),
        };
        const localesService = {
            getLocale: jest.fn().mockResolvedValue({}),
        };
        const embeddingService = {
            generateEmbedding: jest.fn().mockResolvedValue([]),
        };
        const service = new AgentOrchestratorService(
            coordinatorAgent as never,
            searchAgent as never,
            responseAgent as never,
            {} as never,
            localesService as never,
            embeddingService as never,
        );

        const result = await service.orchestrateWorkflow(
            'session_1',
            'о чем ты мне говорил',
            undefined,
            [
                '=== Последние сообщения ===',
                'Клиент: фац это что такое ?',
                'Ассистент: ФАЦ — это Федеральный аккредитационный центр ПГМУ.',
                'Клиент: какая аккредитация есть ?',
                'Ассистент: ФАЦ ПГМУ проводит первичную и первичную специализированную аккредитацию.',
            ].join('\n'),
            { locale: 'ru' },
            Date.now(),
        );

        expect(result.success).toBe(true);
        expect(coordinatorAgent.process).not.toHaveBeenCalled();
        expect(searchAgent.process).not.toHaveBeenCalled();
        expect(responseAgent.process).toHaveBeenCalledTimes(1);
        expect(responseAgent.process).toHaveBeenCalledWith(
            expect.objectContaining({
                originalQuery: 'о чем ты мне говорил',
                mode: 'answer',
                sourceType: 'context',
                analysisResults: [
                    expect.objectContaining({
                        taskId: 'conversation_memory',
                        data: expect.stringContaining(
                            'ФАЦ — это Федеральный аккредитационный центр ПГМУ',
                        ),
                    }),
                ],
                metadata: expect.objectContaining({
                    conversationContext: expect.stringContaining(
                        'первичную специализированную аккредитацию',
                    ),
                    extras: expect.objectContaining({
                        assistantMode: 'answer',
                        memoryRecall: true,
                    }),
                }),
            }),
        );
    });

    it('enriches short follow-up questions with the recent conversation topic', async () => {
        const coordinatorAgent = {
            process: jest.fn().mockImplementation(async (input) => ({
                success: true,
                sessionId: input.sessionId,
                input: input.input,
                timestamp: '2026-05-19T00:00:00.000Z',
                mode: 'answer',
                agents: [],
                shouldClarify: false,
                clarificationQuestions: [],
                routingReason: 'fac_knowledge',
                overallConfidence: 0.9,
                metrics: {
                    executionTime: 5,
                    inputTokens: 20,
                    outputTokens: 10,
                    totalTokens: 30,
                },
            })),
        };
        const searchAgent = {
            process: jest.fn().mockResolvedValue({
                success: true,
                sessionId: 'session_1',
                timestamp: '2026-05-19T00:00:00.000Z',
                searchResults: [
                    {
                        taskId: 'search_1',
                        instruction: 'олимпиады для студентов',
                        query: 'олимпиады для студентов',
                        results: [
                            {
                                id: 'doc_1',
                                title: 'Олимпиада для студентов',
                                content:
                                    'Олимпиада проводится для студентов высшего образования.',
                                score: 0.9,
                                source: 'knowledge_base',
                                metadata: {},
                            },
                        ],
                        summarizedResponse:
                            'Олимпиада проводится для студентов высшего образования.',
                        metadata: {
                            answerability: 'answerable',
                            coverage: 'full',
                        },
                        confidence: 0.9,
                        success: true,
                    },
                ],
                metrics: {
                    executionTime: 20,
                    inputTokens: 10,
                    outputTokens: 10,
                    totalTokens: 20,
                },
            }),
        };
        const responseAgent = {
            process: jest.fn().mockResolvedValue({
                success: true,
                sessionId: 'session_1',
                timestamp: '2026-05-19T00:00:00.000Z',
                mode: 'answer',
                response:
                    'Олимпиада проводится для студентов высшего образования.',
                confidence: 'high',
                metrics: {
                    executionTime: 15,
                    inputTokens: 100,
                    outputTokens: 20,
                    totalTokens: 120,
                    llmCalls: 0,
                },
                metadata: {
                    executionTime: 15,
                    agentsProcessed: 1,
                    searchResultsCount: 1,
                    analysisResultsCount: 0,
                    hasUrl: false,
                    coordinatorConfidence: 0.9,
                },
            }),
        };
        const specialistCatalog = {
            findBestMatch: jest.fn(),
            toSpecialistInfo: jest.fn(),
        };
        const localesService = {
            getLocale: jest.fn().mockResolvedValue({}),
        };
        const embeddingService = {
            generateEmbedding: jest.fn().mockResolvedValue([]),
        };
        const service = new AgentOrchestratorService(
            coordinatorAgent as never,
            searchAgent as never,
            responseAgent as never,
            specialistCatalog as never,
            localesService as never,
            embeddingService as never,
        );

        await service.orchestrateWorkflow(
            'session_1',
            'для студентов',
            undefined,
            [
                '=== Последние сообщения ===',
                'Клиент: олимпиады',
                'Ассистент: Какие олимпиады вас интересуют?',
            ].join('\n'),
            { locale: 'ru' },
            Date.now(),
        );

        expect(coordinatorAgent.process).toHaveBeenCalledWith(
            expect.objectContaining({
                input: 'олимпиады для студентов',
            }),
        );
        expect(searchAgent.process).toHaveBeenCalledWith(
            expect.objectContaining({
                agents: [
                    expect.objectContaining({
                        tasks: [
                            expect.objectContaining({
                                instruction: 'олимпиады для студентов',
                                parameters: {
                                    query: 'олимпиады для студентов',
                                },
                            }),
                        ],
                    }),
                ],
            }),
        );
        expect(responseAgent.process).toHaveBeenCalledWith(
            expect.objectContaining({
                originalQuery: 'для студентов',
            }),
        );
    });
});
