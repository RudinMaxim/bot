process.env.POSTGRES_URL =
    process.env.POSTGRES_URL ||
    'postgres://postgres:postgres@postgres:5432/app';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'redis';
process.env.OPENROUTER_API_KEY =
    process.env.OPENROUTER_API_KEY || 'sk-or-test';
process.env.MAX_BOT_TOKEN = process.env.MAX_BOT_TOKEN || 'token';
process.env.MAX_WEBHOOK_SECRET = process.env.MAX_WEBHOOK_SECRET || 'secret';

import { SearchAgentService } from '../../search.agent';
import type { SecretsConfig } from 'src/infrastructure/config/interfaces';
import type { EmbeddingService } from 'src/domain/search-base';
import { SearchAgentInput } from '../types/search.types';
import { Logger } from '@nestjs/common';

type SearchResultLike = {
    id: string;
    text: string;
    source: string;
    similarity: number;
    metadata: Record<string, unknown>;
};

function buildSecrets(overrides?: {
    defaultLimit?: number;
    maxLimit?: number;
    minSimilarity?: number;
    hybridAlpha?: number;
}): SecretsConfig {
    return {
        embedding: {
            searchDefaultLimit: overrides?.defaultLimit ?? 5,
            searchMaxLimit: overrides?.maxLimit ?? 10,
            searchDefaultThreshold: overrides?.minSimilarity ?? 0.6,
            searchHybridAlpha: overrides?.hybridAlpha ?? 0.35,
        },
    } as unknown as SecretsConfig;
}

function buildInput(args?: {
    instruction?: string;
    parameters?: Record<string, unknown>;
}): SearchAgentInput {
    return {
        sessionId: 'session_1',
        timestamp: new Date().toISOString(),
        agents: [
            {
                agent_name: 'search_agent',
                priority: 'high',
                tasks: [
                    {
                        instruction:
                            args?.instruction ??
                            'Расскажи про инфраструктуру ЖК',
                        parameters: args?.parameters,
                    },
                ],
            },
        ],
    };
}

function createAgent(
    searchResults?: SearchResultLike[],
    secretOverrides?: {
        defaultLimit?: number;
        maxLimit?: number;
        minSimilarity?: number;
        hybridAlpha?: number;
    },
) {
    const embeddingService = {
        searchSimilar: jest.fn().mockResolvedValue(searchResults ?? []),
    };

    const agent = new SearchAgentService(
        embeddingService as unknown as EmbeddingService,
        buildSecrets(secretOverrides),
    );
    agent.onModuleInit();

    return { agent, embeddingService };
}

describe('SearchAgentService', () => {
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

    describe('unit', () => {
        it('validates missing tasks and agent assignments', () => {
            const { agent } = createAgent();

            const invalidInput = {
                sessionId: 'session_1',
                timestamp: new Date().toISOString(),
                agents: [],
            } as SearchAgentInput;

            const validation = agent.validateInput(invalidInput);

            expect(validation.valid).toBe(false);
            expect(validation.errors).toContain('No agent assignments found');
        });

        it('normalizes search params before vector search', async () => {
            const { agent, embeddingService } = createAgent(
                [
                    {
                        id: 'd1',
                        text: 'Документ',
                        source: 'kb',
                        similarity: 0.9,
                        metadata: {},
                    },
                ],
                { hybridAlpha: 0.42 },
            );

            await agent.process(
                buildInput({
                    instruction: 'ignored',
                    parameters: {
                        query: '  Про парковки  ',
                        limit: 999,
                        similarity: 2,
                    },
                }),
            );

            expect(embeddingService.searchSimilar).toHaveBeenCalledWith(
                'Про парковки',
                expect.objectContaining({
                    limit: 10,
                    threshold: 0,
                    strategy: 'hybrid',
                    hybridAlpha: 0.42,
                    hybridQuery: 'Про парковки',
                    queryProperties: ['title', 'description', 'content', 'text'],
                }),
            );
        });

        it('expands ЖК, улица and район abbreviations in query', async () => {
            const { agent, embeddingService } = createAgent([
                {
                    id: 'd1',
                    text: 'Документ',
                    source: 'kb',
                    similarity: 0.9,
                    metadata: {},
                },
            ]);

            await agent.process(
                buildInput({
                    instruction: 'Что есть в ЖК на ул. Ленина в р-не центра?',
                }),
            );

            expect(embeddingService.searchSimilar).toHaveBeenCalledWith(
                'Что есть в ЖК на ул. Ленина в р-не центра?\nЧто есть в жилой комплекс на улица Ленина в районе центра?',
                expect.objectContaining({
                    strategy: 'hybrid',
                    hybridQuery: 'Что есть в ЖК на ул. Ленина в р-не центра?',
                }),
            );
        });
    });

    describe('business integration scenarios', () => {
        it('rescues and prioritizes a structured topic match over a broader overview result', async () => {
            const { agent } = createAgent([
                {
                    id: 'overview',
                    text: [
                        'topic: project_overview',
                        'intent: concept',
                        'title: Концепция проекта',
                        'search_phrases: что за жк | расскажи о проекте',
                        'facts: Разноформатная застройка.',
                        'answer: ЖК «Мыс» сочетает природу и современный формат жизни.',
                    ].join('\n'),
                    source: 'kb',
                    similarity: 0.91,
                    metadata: { blobType: 'faq' },
                },
                {
                    id: 'parking-underground',
                    text: [
                        'topic: parking',
                        'intent: parking_availability',
                        'title: Подземный паркинг',
                        'search_phrases: есть ли подземный паркинг | есть ли паркинг | парковка в жк мыс',
                        'facts: В проекте предусмотрен подземный паркинг.',
                        'answer: В жилом комплексе предусмотрен подземный паркинг.',
                    ].join('\n'),
                    source: 'kb',
                    similarity: 0.41,
                    metadata: { blobType: 'faq' },
                },
            ]);

            const result = await agent.process(
                buildInput({
                    instruction: 'Есть ли подземный паркинг в ЖК Мыс?',
                }),
            );

            expect(result.success).toBe(true);
            expect(result.searchResults[0].results.length).toBeGreaterThan(0);
            expect(result.searchResults[0].results[0]._additional.id).toBe(
                'parking-underground',
            );
            expect(result.searchResults[0].summarizedResponse).toContain(
                'подземный паркинг',
            );
        });

        it('uses expanded query text for structured reranking', async () => {
            const { agent } = createAgent([
                {
                    id: 'overview',
                    text: [
                        'topic: project_overview',
                        'intent: project_name',
                        'title: Проект',
                        'search_phrases: расскажи о проекте',
                        'facts: Это жилой комплекс.',
                        'answer: Общая информация о проекте.',
                    ].join('\n'),
                    source: 'kb',
                    similarity: 0.91,
                    metadata: { blobType: 'faq' },
                },
                {
                    id: 'project-name',
                    text: [
                        'topic: project_overview',
                        'intent: project_name',
                        'title: Название жилого комплекса',
                        'search_phrases: как называется жилой комплекс мыс | название жилого комплекса',
                        'facts: Название жилого комплекса — «Мыс».',
                        'answer: Жилой комплекс называется «Мыс».',
                    ].join('\n'),
                    source: 'kb',
                    similarity: 0.22,
                    metadata: { blobType: 'faq' },
                },
            ]);

            const result = await agent.process(
                buildInput({
                    instruction: 'Как называется ЖК Мыс?',
                }),
            );

            expect(result.success).toBe(true);
            expect(result.searchResults[0].results[0]._additional.id).toBe(
                'project-name',
            );
        });

        it('expands colloquial initial payment wording to find the relevant card', async () => {
            const { agent, embeddingService } = createAgent([
                {
                    id: 'overview',
                    text: [
                        'topic: project_overview',
                        'intent: concept',
                        'title: Обзор проекта',
                        'search_phrases: расскажи о проекте | что за жк',
                        'facts: Общая информация о проекте.',
                        'answer: ЖК «Мыс» сочетает природу и разные форматы жилья.',
                    ].join('\n'),
                    source: 'kb',
                    similarity: 0.91,
                    metadata: { blobType: 'faq' },
                },
                {
                    id: 'initial-payment',
                    text: [
                        'topic: purchase',
                        'intent: initial_payment',
                        'title: Первоначальный взнос',
                        'search_phrases: первоначальный взнос | минимальный взнос по ипотеке',
                        'facts: Первоначальный взнос — это первый платеж при покупке в ипотеку.',
                        'answer: Для ипотеки в базе знаний есть отдельная тема про первоначальный взнос.',
                    ].join('\n'),
                    source: 'kb',
                    similarity: 0.27,
                    metadata: { blobType: 'faq' },
                },
            ]);

            const result = await agent.process(
                buildInput({
                    instruction: 'Сколько нужно внести сначала?',
                }),
            );

            expect(embeddingService.searchSimilar).toHaveBeenCalledWith(
                expect.stringContaining('первоначальный взнос'),
                expect.any(Object),
            );
            expect(result.success).toBe(true);
            expect(result.searchResults[0].results[0]._additional.id).toBe(
                'initial-payment',
            );
        });

        it('keeps hybrid candidates even when requested similarity is higher', async () => {
            const { agent, embeddingService } = createAgent([
                {
                    id: 'doc_high',
                    text: 'Во дворе есть детский сад.',
                    source: 'kb',
                    similarity: 0.82,
                    metadata: { blobType: 'faq' },
                },
                {
                    id: 'doc_low',
                    text: 'Старый документ.',
                    source: 'kb',
                    similarity: 0.7,
                    metadata: { blobType: 'faq' },
                },
            ]);

            const result = await agent.process(
                buildInput({
                    instruction: 'Инфраструктура',
                    parameters: { similarity: 0.8 },
                }),
            );

            expect(embeddingService.searchSimilar).toHaveBeenCalledTimes(1);
            expect(result.success).toBe(true);
            expect(result.searchResults).toHaveLength(1);
            expect(result.searchResults[0].results).toHaveLength(2);
            expect(result.searchResults[0].results[0]._additional.id).toBe(
                'doc_high',
            );
            expect(result.searchResults[0].metadata.strategy).toBe('hybrid');
            expect(result.searchResults[0].summarizedResponse).toContain(
                'детский сад',
            );
        });

        it('returns fallback search result when vector service fails', async () => {
            const { agent, embeddingService } = createAgent();
            embeddingService.searchSimilar.mockRejectedValueOnce(
                new Error('vector db unavailable'),
            );

            const result = await agent.process(
                buildInput({ instruction: 'Расскажи про школу рядом' }),
            );

            expect(result.success).toBe(true);
            expect(result.searchResults).toHaveLength(1);
            expect(result.searchResults[0].error).toContain(
                'vector db unavailable',
            );
            expect(result.searchResults[0].results[0].metadata?.fallback).toBe(
                true,
            );
            expect(result.searchResults[0].metadata.answerability).toBe(
                'unavailable',
            );
        });

        it('returns fallback when query is empty and does not call vector DB', async () => {
            const { agent, embeddingService } = createAgent();

            const result = await agent.process(
                buildInput({
                    instruction: '   ',
                    parameters: { query: '   ' },
                }),
            );

            expect(embeddingService.searchSimilar).not.toHaveBeenCalled();
            expect(result.success).toBe(true);
            expect(result.searchResults[0].results[0].metadata?.fallback).toBe(
                true,
            );
            expect(result.searchResults[0].metadata.answerability).toBe(
                'unavailable',
            );
        });

        it('returns the best available hybrid candidate instead of empty results', async () => {
            const { agent } = createAgent([
                {
                    id: 'doc_low',
                    text: 'Нерелевантный документ.',
                    source: 'kb',
                    similarity: 0.51,
                    metadata: { blobType: 'faq' },
                },
            ]);

            const result = await agent.process(
                buildInput({
                    instruction: 'Сколько мест в паркинге?',
                    parameters: { similarity: 0.8 },
                }),
            );

            expect(result.success).toBe(true);
            expect(result.searchResults[0].results).toHaveLength(1);
            expect(result.searchResults[0].results[0]._additional.id).toBe(
                'doc_low',
            );
            expect(result.searchResults[0].metadata.answerability).toBe(
                'answerable',
            );
        });

        it('marks coverage as partial when the matched card explicitly requires specialist follow-up', async () => {
            const { agent } = createAgent([
                {
                    id: 'documents',
                    text: [
                        'topic: documents',
                        'intent: required_documents',
                        'title: Документы для аккредитации',
                        'facts: Нужны заявление и паспорт.',
                        'coverage_hint: partial',
                        'restrictions: Для проверки ошибок в документах направлять к специалисту.',
                        'answer: Нужны заявление и паспорт.',
                    ].join('\n'),
                    source: 'kb',
                    similarity: 0.9,
                    metadata: { blobType: 'faq' },
                },
            ]);

            const result = await agent.process(
                buildInput({
                    instruction: 'Какие документы нужны и что делать, если есть ошибка?',
                }),
            );

            expect(result.success).toBe(true);
            expect(result.searchResults[0].metadata.coverage).toBe('partial');
        });

        it('marks coverage as none when no relevant evidence exists', async () => {
            const { agent } = createAgent([]);

            const result = await agent.process(
                buildInput({
                    instruction: 'Совсем неизвестный вопрос',
                }),
            );

            expect(result.success).toBe(true);
            expect(result.searchResults[0].metadata.coverage).toBe('none');
        });
    });
});
