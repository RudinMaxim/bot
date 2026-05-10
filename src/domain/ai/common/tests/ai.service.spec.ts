process.env.POSTGRES_URL =
    process.env.POSTGRES_URL ||
    'postgres://postgres:postgres@postgres:5432/app';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'redis';
process.env.OPENROUTER_API_KEY =
    process.env.OPENROUTER_API_KEY || 'sk-or-test';
import { AiService } from '../../services/ai.service';

describe('AiService request cache', () => {
    const orchestrator = {
        orchestrateWorkflow: jest.fn(),
        processFastResponse: jest.fn(),
    };
    const inputValidation = {
        validateInput: jest.fn(),
    };
    const sessionContext = {
        addMessage: jest.fn(),
        get: jest.fn(),
        getConversationContext: jest.fn(),
        updateQuickRepliesHistory: jest.fn(),
        updateContact: jest.fn(),
        triggerSummarizationIfNeeded: jest.fn(),
        exists: jest.fn(),
        clear: jest.fn(),
    };
    const metricsService = {
        log: jest.fn(),
    };
    const feedbackService = {
        addFeedback: jest.fn(),
    };
    const cancellation = {
        startRun: jest.fn(),
        completeRun: jest.fn(),
        cancel: jest.fn(),
        wasCancelled: jest.fn(),
    };
    const queryCacheRepo = {
        get: jest.fn(),
        set: jest.fn(),
    };
    const localesService = {
        getLocale: jest.fn(),
    };

    let service: AiService;

    beforeEach(() => {
        jest.clearAllMocks();

        cancellation.startRun.mockReturnValue({
            signal: new AbortController().signal,
        });
        cancellation.completeRun.mockReturnValue(undefined);
        inputValidation.validateInput.mockReturnValue({
            isValid: true,
            cleanedInput: 'привет мир',
            metadata: {
                locale: 'ru',
                timestamp: '2026-03-23T00:00:00.000Z',
                originalInput: 'Привет, мир!',
                originalLength: 12,
                cleanedLength: 10,
            },
        });
        sessionContext.addMessage.mockResolvedValue(undefined);
        sessionContext.get.mockResolvedValue(undefined);
        sessionContext.getConversationContext.mockResolvedValue('');
        sessionContext.updateQuickRepliesHistory.mockResolvedValue(undefined);
        sessionContext.updateContact.mockResolvedValue(undefined);
        sessionContext.triggerSummarizationIfNeeded.mockResolvedValue(undefined);
        metricsService.log.mockResolvedValue(undefined);
        localesService.getLocale.mockResolvedValue(undefined);
        queryCacheRepo.get.mockResolvedValue(null);
        queryCacheRepo.set.mockResolvedValue(undefined);

        service = new AiService(
            orchestrator as never,
            inputValidation as never,
            sessionContext as never,
            metricsService as never,
            feedbackService as never,
            cancellation as never,
            queryCacheRepo as never,
            localesService as never,
        );
    });

    it('returns cached response without orchestration on cache hit', async () => {
        queryCacheRepo.get.mockResolvedValue({
            success: true,
            sessionId: 'cached_session',
            timestamp: '2026-03-23T00:00:00.000Z',
            data: {
                response: 'Кэшированный ответ',
                confidence: 'high',
                metadata: {
                    executionTime: 42,
                    agentsProcessed: 1,
                    searchResultsCount: 0,
                    analysisResultsCount: 0,
                    hasUrl: false,
                    coordinatorConfidence: 0.9,
                },
            },
        });

        const result = await service.processMessage(
            'chat_1',
            'Привет, мир!',
            {
                locale: 'ru',
            },
        );

        expect(queryCacheRepo.get).toHaveBeenCalledTimes(1);
        expect(orchestrator.orchestrateWorkflow).not.toHaveBeenCalled();
        expect(result.success).toBe(true);
        expect(result.data?.response).toBe('Кэшированный ответ');
        expect(sessionContext.addMessage).toHaveBeenCalledTimes(2);
        expect(queryCacheRepo.set).not.toHaveBeenCalled();
    });

    it('stores successful orchestration result in redis cache', async () => {
        orchestrator.orchestrateWorkflow.mockResolvedValue({
            success: true,
            sessionId: 'chat_1',
            timestamp: '2026-03-23T00:00:00.000Z',
            data: {
                response: 'Новый ответ',
                confidence: 'high',
                metadata: {
                    executionTime: 75,
                    agentsProcessed: 2,
                    searchResultsCount: 1,
                    analysisResultsCount: 0,
                    hasUrl: false,
                    coordinatorConfidence: 0.8,
                },
            },
        });

        const result = await service.processMessage(
            'chat_1',
            'Привет, мир!',
            {
                locale: 'ru',
            },
        );

        expect(result.success).toBe(true);
        expect(orchestrator.orchestrateWorkflow).toHaveBeenCalledTimes(1);
        expect(queryCacheRepo.set).toHaveBeenCalledTimes(1);
    });

    it('passes pipeline callbacks into orchestrator workflow', async () => {
        orchestrator.orchestrateWorkflow.mockResolvedValue({
            success: true,
            sessionId: 'chat_1',
            timestamp: '2026-03-23T00:00:00.000Z',
            data: {
                response: 'Новый ответ',
                confidence: 'high',
                metadata: {
                    executionTime: 75,
                    agentsProcessed: 2,
                    searchResultsCount: 1,
                    analysisResultsCount: 0,
                    hasUrl: false,
                    coordinatorConfidence: 0.8,
                },
            },
        });
        const callbacks = {
            onPhase: jest.fn(),
            onProgressiveResponse: jest.fn(),
            onResponseChunk: jest.fn(),
        };

        await service.processMessage(
            'chat_1',
            'Привет, мир!',
            {
                locale: 'ru',
            },
            callbacks,
        );

        expect(orchestrator.orchestrateWorkflow).toHaveBeenCalledWith(
            'chat_1',
            'привет мир',
            undefined,
            '',
            expect.any(Object),
            expect.any(Number),
            callbacks,
        );
    });

    it('routes assistant identity queries through orchestrator instead of fast path', async () => {
        localesService.getLocale.mockResolvedValue(undefined);
        inputValidation.validateInput.mockReturnValue({
            isValid: true,
            cleanedInput: 'как тебя зовут',
            metadata: {
                locale: 'ru',
                timestamp: '2026-03-23T00:00:00.000Z',
                originalInput: 'Как тебя зовут?',
                originalLength: 16,
                cleanedLength: 15,
            },
        });
        orchestrator.orchestrateWorkflow.mockResolvedValue({
            success: true,
            sessionId: 'chat_1',
            timestamp: '2026-03-23T00:00:00.000Z',
            data: {
                mode: 'route_to_specialist',
                response:
                    'Точного ответа в базе знаний нет. Лучше обратиться к специалисту.',
                confidence: 'low',
                metadata: {
                    executionTime: 10,
                    agentsProcessed: 1,
                    searchResultsCount: 0,
                    analysisResultsCount: 0,
                    hasUrl: false,
                    coordinatorConfidence: 0.95,
                },
            },
        });

        const result = await service.processMessage('chat_1', 'Как тебя зовут?', {
            locale: 'ru',
        });

        expect(result.success).toBe(true);
        expect(orchestrator.processFastResponse).not.toHaveBeenCalled();
        expect(orchestrator.orchestrateWorkflow).toHaveBeenCalledTimes(1);
        expect(orchestrator.orchestrateWorkflow).toHaveBeenCalledWith(
            'chat_1',
            'как тебя зовут',
            undefined,
            '',
            expect.any(Object),
            expect.any(Number),
            undefined,
        );
    });

    it('normalizes near-identical queries to the same cache key', () => {
        const metadata = {
            locale: 'ru',
            conversationContext: '',
        };

        const firstKey = (service as any).buildRequestCacheKey(
            'Привет, мир!',
            metadata,
        );
        const secondKey = (service as any).buildRequestCacheKey(
            '  привет мир!!!  ',
            metadata,
        );

        expect(firstKey).toBe(secondKey);
    });
});
