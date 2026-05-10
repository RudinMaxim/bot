process.env.POSTGRES_URL =
    process.env.POSTGRES_URL ||
    'postgres://postgres:postgres@postgres:5432/app';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'redis';
process.env.OPENROUTER_API_KEY =
    process.env.OPENROUTER_API_KEY || 'sk-or-test';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { MessageService } = require('../../services/message.service');
import { MessageStatus, MessageType, IncomingMessage } from '../types';
import { buildCacheKey } from 'src/shared/utils/interaction-key.util';
import { Logger } from '@nestjs/common';
import { setLocaleDictionary } from 'src/shared/utils/texts';

function createIncomingMessage(
    overrides: Partial<IncomingMessage> = {},
): IncomingMessage {
    return {
        messageId: 'web_1',
        chatId: 'chat_1',
        userId: 'user_1',
        type: MessageType.TEXT,
        content: 'hello',
        timestamp: new Date('2025-01-01T00:00:00.000Z'),
        metadata: {
            platform: 'web',
            locale: 'en',
        },
        ...overrides,
    };
}

describe('MessageService', () => {
    let logSpy: jest.SpyInstance;
    let warnSpy: jest.SpyInstance;
    let errorSpy: jest.SpyInstance;

    const aiService = {
        processMessage: jest.fn(),
        cancelProcessing: jest.fn(),
        wasRunCancelled: jest.fn(),
        clearSession: jest.fn(),
        logFeedback: jest.fn(),
    };
    const messageCacheRepo = {
        get: jest.fn(),
        set: jest.fn(),
        setFeedbackAlias: jest.fn(),
        getFeedbackSourceKey: jest.fn(),
        delete: jest.fn(),
        getMessagesByChat: jest.fn(),
        deleteByChatId: jest.fn(),
    };

    let service: InstanceType<typeof MessageService>;

    beforeAll(() => {
        setLocaleDictionary('en', {
            system: {
                messaging: {
                    commands: {
                        unknown: 'Unknown command. Use /help for the list of commands',
                        stop: {
                            stopped: 'Stopped generation.',
                            noActive: 'There is no active generation right now.',
                        },
                    },
                    errors: {
                        clearFailed:
                            'Failed to clear history. Please try again later.',
                    },
                },
            },
            content: {
                messaging: {
                    help: '/help  help and capabilities\n/clear  clear chat history\n/stop  stop current generation\n/cancel  cancel current operation',
                    clear: {
                        success: 'Chat history has been cleared.{details}',
                        details: ' Removed messages: {count}.',
                    },
                },
            },
        });
        setLocaleDictionary('ru', {
            system: {
                messaging: {
                    commands: {
                        unknown:
                            'Неизвестная команда. Используйте /help для списка команд',
                        stop: {
                            stopped: 'Остановил генерацию.',
                            noActive: 'Сейчас нет активной генерации.',
                        },
                    },
                    errors: {
                        clearFailed:
                            'Не удалось очистить историю. Попробуйте позже.',
                    },
                },
            },
            content: {
                messaging: {
                    help: '/help  справка по возможностям\n/clear  очистка истории чата\n/stop  остановка текущей генерации\n/cancel  отмена текущей операции',
                    clear: {
                        success: 'История чата очищена.{details}',
                        details: ' Удалено сообщений: {count}.',
                    },
                },
                ai: {
                    quickReplies: {
                        parking_storage: 'Паркинг и кладовые',
                    },
                    quickReplyPrompts: {
                        payment_options:
                            'Расскажи о способах оплаты в ЖК «Мыс».',
                        parking_storage:
                            'Расскажи про паркинг и кладовые в ЖК «Мыс».',
                    },
                },
            },
        });
        logSpy = jest
            .spyOn(Logger.prototype, 'log')
            .mockImplementation(() => undefined);
        warnSpy = jest
            .spyOn(Logger.prototype, 'warn')
            .mockImplementation(() => undefined);
        errorSpy = jest
            .spyOn(Logger.prototype, 'error')
            .mockImplementation(() => undefined);
    });

    afterAll(() => {
        logSpy.mockRestore();
        warnSpy.mockRestore();
        errorSpy.mockRestore();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        aiService.wasRunCancelled.mockReturnValue(false);
        service = new MessageService(aiService as never, messageCacheRepo as never);
    });

    it('handleMessage returns completed and caches response when AI succeeds', async () => {
        aiService.processMessage.mockResolvedValue({
            success: true,
            processingTimeMs: 42,
            data: {
                response: 'Hello back',
                quickReplies: ['option_1'],
                metadata: {
                    agentsProcessed: 2,
                },
            },
        });

        const message = createIncomingMessage();
        const result = await service.handleMessage(message);

        expect(result.status).toBe(MessageStatus.COMPLETED);
        expect(result.response).toBe('Hello back');
        expect(result.quickReplies).toEqual([
            {
                text: 'option_1',
                intent: 'continue_search',
                priority: 0.5,
            },
        ]);
        expect(result).not.toHaveProperty('visuals');
        expect(messageCacheRepo.set).toHaveBeenCalledTimes(1);
        expect(messageCacheRepo.set.mock.calls[0][0]).toBe(
            buildCacheKey(message.chatId, message.messageId),
        );
        expect(messageCacheRepo.set.mock.calls[0][1]).not.toHaveProperty(
            'visuals',
        );
    });

    it('forwards pipeline callbacks to ai service unchanged', async () => {
        aiService.processMessage.mockResolvedValue({
            success: true,
            processingTimeMs: 42,
            data: {
                response: 'Hello back',
                quickReplies: [],
                metadata: {
                    agentsProcessed: 1,
                },
            },
        });
        const callbacks = {
            onPhase: jest.fn(),
            onProgressiveResponse: jest.fn(),
            onResponseChunk: jest.fn(),
        };

        await service.handleMessage(createIncomingMessage(), callbacks);

        expect(aiService.processMessage).toHaveBeenCalledWith(
            'chat_1',
            'hello',
            expect.any(Object),
            callbacks,
        );
    });

    it('expands quick reply keys to localized prompts before AI processing', async () => {
        aiService.processMessage.mockResolvedValue({
            success: true,
            processingTimeMs: 42,
            data: {
                response: 'Payment details',
                quickReplies: [],
            },
        });

        await service.handleMessage(
            createIncomingMessage({
                content: 'payment_options',
                metadata: {
                    platform: 'web',
                    locale: 'ru',
                },
            }),
        );

        expect(aiService.processMessage).toHaveBeenCalledWith(
            'chat_1',
            'Расскажи о способах оплаты в ЖК «Мыс».',
            expect.objectContaining({
                quickReplyIntent: 'ask_payment',
            }),
            undefined,
        );
    });

    it('expands localized quick reply labels to prompts before AI processing', async () => {
        aiService.processMessage.mockResolvedValue({
            success: true,
            processingTimeMs: 42,
            data: {
                response: 'Parking details',
                quickReplies: [],
            },
        });

        await service.handleMessage(
            createIncomingMessage({
                content: 'Паркинг и кладовые',
                metadata: {
                    platform: 'web',
                    locale: 'ru',
                },
            }),
        );

        expect(aiService.processMessage).toHaveBeenCalledWith(
            'chat_1',
            'Расскажи про паркинг и кладовые в ЖК «Мыс».',
            expect.objectContaining({
                quickReplyIntent: 'ask_infrastructure',
            }),
            undefined,
        );
    });

    it('handleMessage returns cancelled when AI reports cancellation', async () => {
        aiService.processMessage.mockResolvedValue({
            success: false,
            error: 'cancelled',
        });

        const result = await service.handleMessage(createIncomingMessage());

        expect(result.status).toBe(MessageStatus.CANCELLED);
        expect(result.error).toBe('cancelled');
    });

    it('suppresses successful AI response when run was cancelled meanwhile', async () => {
        aiService.processMessage.mockResolvedValue({
            success: true,
            processingTimeMs: 42,
            data: {
                response: 'late response',
                quickReplies: [],
            },
        });
        aiService.wasRunCancelled.mockReturnValue(true);

        const result = await service.handleMessage(createIncomingMessage());

        expect(result.status).toBe(MessageStatus.CANCELLED);
        expect(result.error).toBe('cancelled');
        expect(messageCacheRepo.set).not.toHaveBeenCalled();
    });

    it('handleMessage returns failed when AI throws', async () => {
        aiService.processMessage.mockRejectedValue(new Error('ai_down'));

        const result = await service.handleMessage(createIncomingMessage());

        expect(result.status).toBe(MessageStatus.FAILED);
        expect(result.error).toBe('ai_down');
    });

    it('handleCommand returns localized help text', async () => {
        const result = await service.handleCommand(
            createIncomingMessage({
                type: MessageType.COMMAND,
                content: '/help',
            }),
            '/help',
        );

        expect(result.status).toBe(MessageStatus.COMPLETED);
        expect(result.response).toBe(
            '/help  help and capabilities\n/clear  clear chat history\n/stop  stop current generation\n/cancel  cancel current operation',
        );
    });

    it('handleCommand returns localized clear confirmation', async () => {
        aiService.clearSession.mockResolvedValue(undefined);
        messageCacheRepo.deleteByChatId.mockResolvedValue(3);

        const result = await service.handleCommand(
            createIncomingMessage({
                type: MessageType.COMMAND,
                content: '/clear',
            }),
            '/clear',
        );

        expect(aiService.clearSession).toHaveBeenCalledWith('chat_1');
        expect(messageCacheRepo.deleteByChatId).toHaveBeenCalledWith('chat_1');
        expect(result.status).toBe(MessageStatus.COMPLETED);
        expect(result.response).toBe(
            'Chat history has been cleared. Removed messages: 3.',
        );
    });

    it('handleFeedbackByKey returns invalid_key for malformed key', async () => {
        const result = await service.handleFeedbackByKey({
            key: 'broken',
            feedbackValue: 1,
        });

        expect(result).toBe('invalid_key');
    });

    it('handleFeedbackByKey returns not_found when cached message is missing', async () => {
        messageCacheRepo.get.mockResolvedValue(null);
        messageCacheRepo.getFeedbackSourceKey.mockResolvedValue(null);

        const result = await service.handleFeedbackByKey({
            key: 'chat_1:web_1',
            feedbackValue: 1,
        });

        expect(result).toBe('not_found');
    });

    it('handleFeedback resolves assistant response alias and updates source cache entry', async () => {
        messageCacheRepo.get.mockResolvedValueOnce(null).mockResolvedValueOnce({
            request: 'hello',
            response: 'world',
            metadata: {
                chatId: 'chat_1',
                messageId: 'web_1',
                sessionId: 'chat_1',
                inputType: MessageType.TEXT,
                platform: 'web',
                userId: 'alice',
                timestamp: new Date().toISOString(),
            },
        });
        messageCacheRepo.getFeedbackSourceKey.mockResolvedValue('chat_1:web_1');

        const result = await service.handleFeedback({
            chatId: 'chat_1',
            messageId: 'assistant_1',
            key: 'chat_1:assistant_1',
            feedbackValue: 1,
        });

        expect(result).toBe(true);
        expect(messageCacheRepo.getFeedbackSourceKey).toHaveBeenCalledWith(
            'chat_1',
            'assistant_1',
        );
        expect(messageCacheRepo.set).toHaveBeenCalledWith(
            'chat_1:web_1',
            expect.objectContaining({
                feedbackValue: 1,
            }),
        );
    });

    it('handleFeedback stores feedback and updates cache when key and metadata match', async () => {
        messageCacheRepo.get.mockResolvedValue({
            request: 'hello',
            response: 'world',
            metadata: {
                chatId: 'chat_1',
                messageId: 'web_1',
                sessionId: 'chat_1',
                inputType: MessageType.TEXT,
                platform: 'web',
                userId: 'alice',
                timestamp: new Date().toISOString(),
            },
        });

        const result = await service.handleFeedback({
            chatId: 'chat_1',
            messageId: 'web_1',
            key: 'chat_1:web_1',
            feedbackValue: 1,
        });

        expect(result).toBe(true);
        expect(aiService.logFeedback).toHaveBeenCalledTimes(1);
        expect(messageCacheRepo.set).toHaveBeenCalledWith(
            'chat_1:web_1',
            expect.objectContaining({
                feedbackValue: 1,
            }),
        );
    });

    it('saveResponseFeedbackAlias stores alias for assistant response id', async () => {
        await service.saveResponseFeedbackAlias(
            'chat_1',
            'web_1',
            'assistant_1',
        );

        expect(messageCacheRepo.setFeedbackAlias).toHaveBeenCalledWith(
            'chat_1',
            'assistant_1',
            buildCacheKey('chat_1', 'web_1'),
        );
    });

    it('clearSessionAndHistory clears both AI session and cached history', async () => {
        aiService.clearSession.mockResolvedValue(undefined);
        messageCacheRepo.deleteByChatId.mockResolvedValue(5);

        const result = await service.clearSessionAndHistory('chat_1');

        expect(result).toEqual({ clearedMessages: 5 });
        expect(aiService.clearSession).toHaveBeenCalledWith('chat_1');
        expect(messageCacheRepo.deleteByChatId).toHaveBeenCalledWith('chat_1');
    });

    it('clearSessionAndHistory throws normalized error on failure', async () => {
        aiService.clearSession.mockRejectedValue(new Error('ai_unavailable'));

        await expect(service.clearSessionAndHistory('chat_1')).rejects.toThrow(
            'Failed to clear session',
        );
    });
});
