process.env.POSTGRES_URL =
    process.env.POSTGRES_URL ||
    'postgres://postgres:postgres@postgres:5432/app';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'redis';
process.env.OPENROUTER_API_KEY =
    process.env.OPENROUTER_API_KEY || 'sk-or-test';
import { Logger } from '@nestjs/common';
import type { SecretsConfig } from 'src/infrastructure/config/interfaces';
import type { LocalesService } from 'src/domain/locales/services';
import { ResponseAgentService } from '../../response.agent';
import { ResponseQuickRepliesService } from '../services/response-quick-replies.service';
import type { ResponseAgentInput } from '../../common/types/response.types';

function buildSecrets(): SecretsConfig {
    return {
        ai: {
            llm: {
                apiKey: 'test-key',
            },
            models: {
                response: ['gpt-5.2'],
            },
            http: {
                timeout: 1000,
                maxRetries: 1,
            },
        },
    } as unknown as SecretsConfig;
}

function buildInput(
    overrides?: Partial<ResponseAgentInput>,
): ResponseAgentInput {
    return {
        sessionId: 'response-session',
        timestamp: new Date().toISOString(),
        originalQuery: 'какие документы нужны',
        searchResults: [],
        analysisResults: [],
        metadata: {
            locale: 'ru',
        },
        ...overrides,
    };
}

function createAgent() {
    const localesService = {
        getLocale: jest.fn().mockResolvedValue({}),
    };

    const agent = new ResponseAgentService(
        buildSecrets(),
        localesService as unknown as LocalesService,
        new ResponseQuickRepliesService(),
    );
    agent.onModuleInit();

    return { agent, localesService };
}

describe('ResponseAgentService', () => {
    let logSpy: jest.SpyInstance;
    let warnSpy: jest.SpyInstance;
    let errorSpy: jest.SpyInstance;
    let debugSpy: jest.SpyInstance;

    beforeAll(() => {
        logSpy = jest
            .spyOn(Logger.prototype, 'log')
            .mockImplementation(() => undefined);
        warnSpy = jest
            .spyOn(Logger.prototype, 'warn')
            .mockImplementation(() => undefined);
        errorSpy = jest
            .spyOn(Logger.prototype, 'error')
            .mockImplementation(() => undefined);
        debugSpy = jest
            .spyOn(Logger.prototype, 'debug')
            .mockImplementation(() => undefined);
    });

    afterAll(() => {
        logSpy.mockRestore();
        warnSpy.mockRestore();
        errorSpy.mockRestore();
        debugSpy.mockRestore();
    });

    it('returns answer mode with knowledge-base summary', async () => {
        const { agent } = createAgent();

        const result = await agent.process(
            buildInput({
                mode: 'answer',
                searchResults: [
                    {
                        taskId: 's1',
                        query: 'какие документы нужны',
                        summarizedResponse:
                            'По базе знаний нужны заявление и документ, удостоверяющий личность.',
                        results: [],
                        metadata: {
                            totalResults: 1,
                            similarity: 0.91,
                            executionTime: 10,
                            answerability: 'answerable',
                        },
                    },
                ],
            }),
        );

        expect(result.success).toBe(true);
        expect(result.mode).toBe('answer');
        expect(result.response).toContain(
            'По базе знаний нужны заявление и документ, удостоверяющий личность.',
        );
        expect(result.specialist).toBeUndefined();
        expect(result).not.toHaveProperty('visuals');
    });

    it('returns clarify mode with short questions', async () => {
        const { agent } = createAgent();

        const result = await agent.process(
            buildInput({
                mode: 'clarify',
                clarificationQuestions: [
                    'Что именно вы хотите уточнить по аккредитации?',
                ],
            }),
        );

        expect(result.success).toBe(true);
        expect(result.mode).toBe('clarify');
        expect(result.response).toContain(
            'Что именно вы хотите уточнить по аккредитации?',
        );
        expect(result.clarificationQuestions).toEqual([
            'Что именно вы хотите уточнить по аккредитации?',
        ]);
    });

    it('returns partial answer with specialist details', async () => {
        const { agent } = createAgent();

        const result = await agent.process(
            buildInput({
                mode: 'partial_with_specialist',
                specialist: {
                    fullName: 'Иванов Иван Иванович',
                    position: 'Специалист по аккредитации',
                    contact: '@ivanov',
                    reason: 'Поможет проверить документы',
                },
                searchResults: [
                    {
                        taskId: 's1',
                        query: 'какие документы нужны',
                        summarizedResponse: 'Нужны заявление и паспорт.',
                        results: [],
                        metadata: {
                            totalResults: 1,
                            similarity: 0.91,
                            executionTime: 10,
                            answerability: 'answerable',
                        },
                    },
                ],
            }),
        );

        expect(result.success).toBe(true);
        expect(result.mode).toBe('partial_with_specialist');
        expect(result.response).toContain('Нужны заявление и паспорт.');
        expect(result.response).toContain('Иванов Иван Иванович');
        expect(result.specialist?.contact).toBe('@ivanov');
    });

    it('returns direct specialist routing when no reliable answer exists', async () => {
        const { agent } = createAgent();

        const result = await agent.process(
            buildInput({
                mode: 'route_to_specialist',
                specialist: {
                    fullName: 'Иванов Иван Иванович',
                    position: 'Специалист по аккредитации',
                    contact: '@ivanov',
                    reason: 'Поможет по нестандартным случаям',
                },
            }),
        );

        expect(result.success).toBe(true);
        expect(result.mode).toBe('route_to_specialist');
        expect(result.response).toContain(
            'С этим лучше обратиться к профильному специалисту центра.',
        );
        expect(result.response).not.toContain('базе знаний');
        expect(result.response).toContain('Иванов Иван Иванович');
        expect(result.response).toContain('@ivanov');
    });
});
