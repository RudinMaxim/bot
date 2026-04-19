import { MessagingGateway } from '../../controller/messaging.getaway';
import { MessageStatus, MessageType, IncomingMessage } from '../types';
import { ProcessingPhase } from 'src/shared/types/processing-phase';

function createIncomingMessage(
    overrides: Partial<IncomingMessage> = {},
): IncomingMessage {
    return {
        messageId: 'web_1',
        chatId: 'chat_1',
        userId: 'user_1',
        username: 'alice',
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

describe('MessagingGateway', () => {
    const adapter = {
        platform: 'web',
        onMessage: jest.fn(),
        sendMessage: jest.fn(),
        sendStatusUpdate: jest.fn(),
    };

    const handler = {
        handleCommand: jest.fn(),
        handleVoiceMessage: jest.fn(),
        handleMessage: jest.fn(),
        saveResponseFeedbackAlias: jest.fn(),
        wasMessageCancelled: jest.fn(),
    };

    let gateway: MessagingGateway;

    beforeEach(() => {
        jest.clearAllMocks();
        adapter.sendMessage.mockResolvedValue('web_out_1');
        adapter.sendStatusUpdate.mockResolvedValue(undefined);
        handler.saveResponseFeedbackAlias.mockResolvedValue(undefined);
        handler.wasMessageCancelled.mockReturnValue(false);
        gateway = new MessagingGateway(adapter as never, handler as never);
    });

    it('suppresses completed response when message was cancelled right before send', async () => {
        handler.wasMessageCancelled.mockReturnValue(true);
        const message = createIncomingMessage();

        await (gateway as any).respondWithResult(adapter, message, {
            originalMessage: message,
            response: 'late response',
            status: MessageStatus.COMPLETED,
            metrics: { processingTimeMs: 42 },
        });

        expect(adapter.sendMessage).not.toHaveBeenCalled();
        expect(handler.saveResponseFeedbackAlias).not.toHaveBeenCalled();
        expect(adapter.sendStatusUpdate).toHaveBeenCalledWith(
            'chat_1',
            MessageStatus.CANCELLED,
            {
                messageId: 'web_1',
                reason: 'cancelled',
            },
        );
    });

    it('suppresses completed response after cancel_generation even when AI run already completed', async () => {
        handler.handleCommand.mockResolvedValue({
            originalMessage: createIncomingMessage({
                type: MessageType.COMMAND,
                content: '/stop',
            }),
            response: 'stopped',
            status: MessageStatus.COMPLETED,
            metrics: { processingTimeMs: 0 },
        });

        await (gateway as any).handleIncomingMessage(
            adapter,
            createIncomingMessage({
                messageId: 'cancel_1',
                type: MessageType.COMMAND,
                content: '/stop',
                metadata: {
                    platform: 'web',
                    locale: 'en',
                    triggeredBy: 'cancel_generation',
                },
            }),
        );

        adapter.sendMessage.mockClear();
        adapter.sendStatusUpdate.mockClear();
        handler.saveResponseFeedbackAlias.mockClear();
        handler.wasMessageCancelled.mockReturnValue(false);

        const message = createIncomingMessage();
        await (gateway as any).respondWithResult(adapter, message, {
            originalMessage: message,
            response: 'late response',
            status: MessageStatus.COMPLETED,
            metrics: { processingTimeMs: 42 },
        });

        expect(adapter.sendMessage).not.toHaveBeenCalled();
        expect(handler.saveResponseFeedbackAlias).not.toHaveBeenCalled();
        expect(adapter.sendStatusUpdate).toHaveBeenCalledWith(
            'chat_1',
            MessageStatus.CANCELLED,
            {
                messageId: 'web_1',
                reason: 'cancelled',
            },
        );
    });

    it('does not emit websocket message for cancel_generation command', async () => {
        handler.handleCommand.mockResolvedValue({
            originalMessage: createIncomingMessage({
                type: MessageType.COMMAND,
                content: '/stop',
            }),
            response: 'no active generation',
            status: MessageStatus.COMPLETED,
            metrics: { processingTimeMs: 0 },
        });

        await (gateway as any).handleIncomingMessage(
            adapter,
            createIncomingMessage({
                messageId: 'cancel_1',
                type: MessageType.COMMAND,
                content: '/stop',
                metadata: {
                    platform: 'web',
                    locale: 'en',
                    triggeredBy: 'cancel_generation',
                },
            }),
        );

        expect(handler.handleCommand).toHaveBeenCalledTimes(1);
        expect(adapter.sendMessage).not.toHaveBeenCalled();
    });

    it('emits completed status and response for regular slash commands', async () => {
        handler.handleCommand.mockResolvedValue({
            originalMessage: createIncomingMessage({
                type: MessageType.COMMAND,
                content: '/help',
            }),
            response: 'command help',
            status: MessageStatus.COMPLETED,
            metrics: { processingTimeMs: 0 },
        });

        await (gateway as any).handleIncomingMessage(
            adapter,
            createIncomingMessage({
                messageId: 'command_1',
                type: MessageType.COMMAND,
                content: '/help',
            }),
        );

        expect(adapter.sendMessage).toHaveBeenCalledWith({
            chatId: 'chat_1',
            content: 'command help',
            replyToMessageId: 'command_1',
        });
        expect(adapter.sendStatusUpdate).toHaveBeenCalledWith(
            'chat_1',
            MessageStatus.COMPLETED,
            {
                messageId: 'command_1',
                responseMessageId: 'web_out_1',
                platform: 'web',
            },
        );
    });

    it('passes site actions to adapter sendMessage and completes request', async () => {
        const message = createIncomingMessage();
        const actions = [
            {
                type: 'scroll_to_section',
                params: { element_id: 'hero' },
            },
        ];

        await (gateway as any).respondWithResult(adapter, message, {
            originalMessage: message,
            response: 'done',
            status: MessageStatus.COMPLETED,
            actions: actions as never,
            quickReplies: ['next_step'],
            metrics: { processingTimeMs: 42 },
        });

        expect(adapter.sendMessage).toHaveBeenCalledWith({
            chatId: 'chat_1',
            content: 'done',
            replyToMessageId: 'web_1',
            keyboard: ['next_step'],
            visuals: undefined,
            actions,
        });
        expect(handler.saveResponseFeedbackAlias).toHaveBeenCalledWith(
            'chat_1',
            'web_1',
            'web_out_1',
        );
        expect(adapter.sendStatusUpdate).toHaveBeenLastCalledWith(
            'chat_1',
            MessageStatus.COMPLETED,
            expect.objectContaining({
                messageId: 'web_1',
                responseMessageId: 'web_out_1',
                platform: 'web',
            }),
        );
    });

    it('emits progressive response payloads and stream chunks via progress events', async () => {
        const message = createIncomingMessage();
        const quickReplies = [
            {
                text: 'show_all_apartments',
                intent: 'explore_similar',
                priority: 0.9,
            },
        ];
        const visuals = [
            {
                type: 'property_cards',
                title: 'Подходящие варианты',
                items: [
                    {
                        id: 'lot_1',
                        name: 'Лот 1',
                    },
                ],
            },
        ];

        handler.handleMessage.mockImplementation(
            async (_incomingMessage, callbacks) => {
                callbacks?.onPhase?.(ProcessingPhase.SEARCHING);
                callbacks?.onProgressiveResponse?.({
                    quickReplies: quickReplies as never,
                    visuals: visuals as never,
                });
                callbacks?.onResponseChunk?.({
                    chunk: 'Подбираю',
                    text: 'Подбираю',
                });

                return {
                    originalMessage: message,
                    response: 'Подбираю варианты',
                    status: MessageStatus.COMPLETED,
                    quickReplies: quickReplies as never,
                    visuals: visuals as never,
                    metrics: { processingTimeMs: 42 },
                };
            },
        );

        await (gateway as any).handleIncomingMessage(adapter, message);

        expect(adapter.sendStatusUpdate).toHaveBeenCalledWith(
            'chat_1',
            MessageStatus.PROCESSING,
            {
                messageId: 'web_1',
                phase: ProcessingPhase.SEARCHING,
            },
        );
        expect(adapter.sendStatusUpdate).toHaveBeenCalledWith(
            'chat_1',
            MessageStatus.PROCESSING,
            {
                messageId: 'web_1',
                phase: ProcessingPhase.RESULTS,
                quickReplies,
                visuals,
                actions: undefined,
            },
        );
        expect(adapter.sendStatusUpdate).toHaveBeenCalledWith(
            'chat_1',
            MessageStatus.PROCESSING,
            {
                messageId: 'web_1',
                phase: ProcessingPhase.STREAMING,
                chunk: 'Подбираю',
            },
        );
    });
});
