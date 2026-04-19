import { WebAdapterService } from '../../services/web.service';
import { SecretsConfig } from 'src/infrastructure/config';
import { RateLimitRepository } from '../../repository';
import { SiteActionRunnerService } from '../../services/site-action-runner.service';
import { MessageType, WebSocketChatMessage } from '../types';
import { WebSocketEvents } from '../constants';
import {
    ChatOwnershipService,
    ChatNotOwnedError,
    IdentityService,
} from 'src/shared/security';

function buildSecretsConfig(): SecretsConfig {
    return {
        rateLimit: {
            ttl: 60,
            limit: 10,
        },
        ai: {
            siteAssistant: {
                crawler: {
                    baseUrls: ['https://example.com'],
                },
            },
        },
    } as unknown as SecretsConfig;
}

function createService(overrides?: {
    identityResolve?: jest.Mock;
    chatOwnershipAssert?: jest.Mock;
}) {
    const siteActionRunner = {
        configure: jest.fn(),
        resumeDeferredRuns: jest.fn().mockResolvedValue(undefined),
        handleResult: jest.fn().mockResolvedValue(undefined),
        startRun: jest.fn().mockResolvedValue(undefined),
        cleanupAll: jest.fn().mockResolvedValue(undefined),
    };

    const rateLimitRepo = {
        consume: jest.fn().mockResolvedValue(true),
    };

    const identityService = {
        resolve:
            overrides?.identityResolve ??
            jest.fn().mockReturnValue({
                sessionId: 'session_stub',
                source: 'cookie',
                issuedAt: 1700000000,
            }),
        issue: jest.fn(),
    };

    const chatOwnership = {
        bind: jest.fn().mockResolvedValue(undefined),
        assertOwned:
            overrides?.chatOwnershipAssert ??
            jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
    };

    const service = new WebAdapterService(
        buildSecretsConfig(),
        siteActionRunner as unknown as SiteActionRunnerService,
        rateLimitRepo as unknown as RateLimitRepository,
        identityService as unknown as IdentityService,
        chatOwnership as unknown as ChatOwnershipService,
    );

    return {
        service,
        siteActionRunner,
        rateLimitRepo,
        identityService,
        chatOwnership,
    };
}

function createIoMock() {
    const emit = jest.fn();
    const room = { emit };

    return {
        to: jest.fn().mockReturnValue(room),
        use: jest.fn(),
        removeAllListeners: jest.fn(),
        on: jest.fn(),
        disconnectSockets: jest.fn(),
        close: jest.fn((callback?: () => void) => callback?.()),
        emit,
    };
}

describe('WebAdapterService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('does not mutate incoming metadata extras while building message payload', () => {
        const { service } = createService();

        const socket = {
            id: 'socket_1',
            handshake: {
                headers: {},
            },
        };
        const metadata = {
            locale: 'en',
            extras: {
                traceId: 'trace_1',
            },
            siteAssistantContext: {
                current_url: 'https://example.com/page',
            },
        };
        const data: WebSocketChatMessage = {
            body: {
                chatId: ' chat_1 ',
                username: 'alice',
                type: MessageType.TEXT,
                content: 'hello',
                replyToMessageId: 'origin_1',
            },
            metadata,
        };

        const incoming = (service as any).buildIncomingMessage(
            socket,
            data,
            {
                buffer: Buffer.from('audio'),
                mimeType: 'audio/webm',
                fileExtension: 'webm',
                sizeBytes: 5,
                durationMs: 1200,
                fileName: 'voice.webm',
            },
            '',
        );

        expect(metadata.extras).toEqual({
            traceId: 'trace_1',
        });
        expect(incoming.metadata?.extras).toMatchObject({
            traceId: 'trace_1',
            siteAssistantContext: {
                current_url: 'https://example.com/page',
            },
        });
        expect(incoming.metadata?.replyToMessageId).toBe('origin_1');
        expect(incoming.metadata?.socketId).toBe('socket_1');
    });

    it('buildCancelMessage creates command payload with normalized username', () => {
        const { service } = createService();

        const socket = {
            id: 'socket_1',
            handshake: {
                headers: {},
            },
        };

        const cancelMessage = (service as any).buildCancelMessage(socket, {
            body: {
                chatId: ' chat_1 ',
                username: '   ',
            },
            metadata: {
                locale: 'en',
            },
        });

        expect(cancelMessage.chatId).toBe('chat_1');
        expect(cancelMessage.type).toBe(MessageType.COMMAND);
        expect(cancelMessage.content).toBe('/stop');
        expect(cancelMessage.userId).toBe('web_user');
        expect(cancelMessage.metadata?.triggeredBy).toBe('cancel_generation');
    });

    it('resolveMessageType derives command and audio types from payload', () => {
        const { service } = createService();

        expect(
            (service as any).resolveMessageType({
                rawType: MessageType.TEXT,
                content: '/help',
            }),
        ).toBe(MessageType.COMMAND);

        expect(
            (service as any).resolveMessageType({
                rawType: 'unknown',
                content: 'hello',
                audioPayload: {
                    buffer: Buffer.from('audio'),
                    mimeType: 'audio/webm',
                    fileExtension: 'webm',
                    sizeBytes: 5,
                },
            }),
        ).toBe(MessageType.VOICE);

        expect(
            (service as any).resolveMessageType({
                rawType: MessageType.AUDIO,
                content: 'hello',
                audioPayload: {
                    buffer: Buffer.from('audio'),
                    mimeType: 'audio/webm',
                    fileExtension: 'webm',
                    sizeBytes: 5,
                },
            }),
        ).toBe(MessageType.AUDIO);
    });

    it('sendMessage emits compact websocket envelope and starts site action run', async () => {
        const { service, siteActionRunner } = createService();
        const ioMock = createIoMock();

        await service.initialize({ io: ioMock as never });
        jest.spyOn(service as any, 'buildMessageId').mockReturnValue('web_out_1');

        const actions = [
            {
                type: 'scroll_to_section',
                params: { element_id: 'hero' },
            },
        ];

        const messageId = await service.sendMessage({
            chatId: 'chat_1',
            content: 'hello',
            replyToMessageId: 'web_in_1',
            keyboard: [
                {
                    text: 'continue_search',
                    intent: 'continue_search',
                    priority: 1,
                    payload: {
                        excludePropertyIds: ['1'],
                    },
                },
                'No',
            ],
            parseMode: 'Markdown',
            actions: actions as never,
        });

        expect(messageId).toBe('web_out_1');
        expect(ioMock.to).toHaveBeenCalledWith('chat_1');
        expect(ioMock.emit).toHaveBeenCalledWith(WebSocketEvents.MESSAGE, {
            body: {
                messageId: 'web_out_1',
                content: 'hello',
                replyToMessageId: 'web_in_1',
                keyboard: {
                    inline: [
                        [
                            {
                                text: 'continue_search',
                                callbackData: 'continue_search',
                            },
                        ],
                        [{ text: 'No', callbackData: 'No' }],
                    ],
                },
            },
            metadata: {
                parseMode: 'Markdown',
            },
        });
        expect(siteActionRunner.startRun).toHaveBeenCalledWith(
            'chat_1',
            'web_out_1',
            actions,
        );
    });

    it('sendStatusUpdate trims reason and defaults platform', async () => {
        const { service } = createService();
        const ioMock = createIoMock();
        await service.initialize({ io: ioMock as never });

        await service.sendStatusUpdate('chat_1', 'failed', {
            reason: '  timeout  ',
            messageId: 'web_1',
        });

        expect(ioMock.emit).toHaveBeenCalledWith(WebSocketEvents.PROGRESS, {
            body: {
                status: 'failed',
                messageId: 'web_1',
            },
            metadata: {
                platform: 'web',
                reason: 'timeout',
            },
        });
    });

    describe('Phase 1.D handshake auth', () => {
        function buildSocket(
            overrides: Partial<{
                headers: Record<string, string | undefined>;
                auth: Record<string, unknown>;
            }> = {},
        ) {
            return {
                id: 'socket_1',
                data: {} as { identity?: unknown },
                handshake: {
                    headers: overrides.headers ?? {},
                    auth: overrides.auth ?? {},
                    address: '127.0.0.1',
                },
                emit: jest.fn(),
                join: jest.fn(),
            };
        }

        it('rejects handshake when identity cannot be resolved', async () => {
            const identityResolve = jest.fn().mockReturnValue(null);
            const { service } = createService({ identityResolve });
            const socket = buildSocket();
            const next = jest.fn();

            await (service as any).handleConnectionMiddleware(socket, next);

            expect(identityResolve).toHaveBeenCalledTimes(1);
            expect(next).toHaveBeenCalledTimes(1);
            const err = next.mock.calls[0][0] as Error;
            expect(err).toBeInstanceOf(Error);
            expect(err.message).toBe('NO_IDENTITY');
            expect(socket.data.identity).toBeUndefined();
        });

        it('stores identity on socket.data when handshake resolves', async () => {
            const identity = {
                sessionId: 'session_A',
                source: 'cookie' as const,
                issuedAt: 1700000000,
            };
            const identityResolve = jest.fn().mockReturnValue(identity);
            const { service } = createService({ identityResolve });
            const socket = buildSocket({
                headers: { cookie: 'sid=signed' },
            });
            const next = jest.fn();

            await (service as any).handleConnectionMiddleware(socket, next);

            expect(next).toHaveBeenCalledWith();
            expect(socket.data.identity).toEqual(identity);
        });

        it('promotes auth.jwt to Authorization header for IdentityService', async () => {
            const identityResolve = jest.fn().mockReturnValue({
                sessionId: 'session_jwt',
                source: 'jwt',
                issuedAt: 1700000000,
            });
            const { service } = createService({ identityResolve });
            const socket = buildSocket({ auth: { jwt: 'token_abc' } });
            const next = jest.fn();

            await (service as any).handleConnectionMiddleware(socket, next);

            const req = identityResolve.mock.calls[0][0] as {
                headers: Record<string, string>;
            };
            expect(req.headers['authorization']).toBe('Bearer token_abc');
            expect(next).toHaveBeenCalledWith();
        });

        it('rejects handshake when rate limit exceeded before identity check', async () => {
            const identityResolve = jest.fn();
            const { service, rateLimitRepo } = createService({
                identityResolve,
            });
            rateLimitRepo.consume.mockResolvedValueOnce(false);
            const socket = buildSocket();
            const next = jest.fn();

            await (service as any).handleConnectionMiddleware(socket, next);

            expect(identityResolve).not.toHaveBeenCalled();
            expect(next).toHaveBeenCalledTimes(1);
            expect((next.mock.calls[0][0] as Error).message).toBe(
                'Too many connection attempts',
            );
        });
    });

    describe('Phase 1.D chat ownership enforcement', () => {
        function buildAuthedSocket(sessionId: string) {
            return {
                id: 'socket_auth',
                data: {
                    identity: {
                        sessionId,
                        source: 'cookie' as const,
                        issuedAt: 1700000000,
                    },
                },
                handshake: {
                    headers: {},
                    auth: {},
                    address: '127.0.0.1',
                },
                emit: jest.fn(),
                join: jest.fn(),
            };
        }

        it('join event rejects a chatId the session does not own', async () => {
            const chatOwnershipAssert = jest
                .fn()
                .mockRejectedValue(
                    new ChatNotOwnedError('chat_other', 'session_A'),
                );
            const { service, siteActionRunner } = createService({
                chatOwnershipAssert,
            });
            const socket = buildAuthedSocket('session_A');

            await (service as any).handleJoinEvent(socket, {
                body: { chatId: 'chat_other' },
            });

            expect(chatOwnershipAssert).toHaveBeenCalledWith(
                'chat_other',
                'session_A',
            );
            expect(socket.join).not.toHaveBeenCalled();
            expect(socket.emit).toHaveBeenCalledWith('error', {
                message: 'CHAT_NOT_OWNED',
            });
            expect(siteActionRunner.resumeDeferredRuns).not.toHaveBeenCalled();
        });

        it('join event joins room when ownership check passes', async () => {
            const { service, siteActionRunner } = createService();
            const socket = buildAuthedSocket('session_A');

            await (service as any).handleJoinEvent(socket, {
                body: { chatId: 'chat_A' },
            });

            expect(socket.join).toHaveBeenCalledWith('chat_A');
            expect(siteActionRunner.resumeDeferredRuns).toHaveBeenCalledWith(
                'chat_A',
            );
            expect(socket.emit).not.toHaveBeenCalledWith(
                'error',
                expect.anything(),
            );
        });

        it('chat_message event rejects foreign chatId without invoking messageCallback', async () => {
            const chatOwnershipAssert = jest
                .fn()
                .mockRejectedValue(
                    new ChatNotOwnedError('chat_other', 'session_A'),
                );
            const { service } = createService({ chatOwnershipAssert });
            const socket = buildAuthedSocket('session_A');
            const handler = jest.fn().mockResolvedValue(undefined);
            service.onMessage(handler);

            await (service as any).handleChatMessageEvent(socket, {
                body: {
                    chatId: 'chat_other',
                    username: 'alice',
                    type: MessageType.TEXT,
                    content: 'hello',
                },
                metadata: {},
            });

            expect(chatOwnershipAssert).toHaveBeenCalledWith(
                'chat_other',
                'session_A',
            );
            expect(handler).not.toHaveBeenCalled();
            expect(socket.join).not.toHaveBeenCalled();
            expect(socket.emit).toHaveBeenCalledWith('error', {
                message: 'CHAT_NOT_OWNED',
            });
        });

        it('emits NO_IDENTITY error when socket has no stored identity', async () => {
            const { service } = createService();
            const socket = {
                id: 'socket_x',
                data: {},
                handshake: { headers: {}, auth: {}, address: '127.0.0.1' },
                emit: jest.fn(),
                join: jest.fn(),
            };

            const ok = await (service as any).assertChatAccess(
                socket,
                'chat_any',
            );

            expect(ok).toBe(false);
            expect(socket.emit).toHaveBeenCalledWith('error', {
                message: 'NO_IDENTITY',
            });
        });
    });

    it('sendStatusUpdate emits progressive payload fields without stripping them', async () => {
        const { service } = createService();
        const ioMock = createIoMock();
        await service.initialize({ io: ioMock as never });

        await service.sendStatusUpdate('chat_1', 'processing', {
            messageId: 'web_1',
            phase: 'results' as never,
            quickReplies: [
                {
                    text: 'show_all_apartments',
                    intent: 'explore_similar',
                    priority: 0.9,
                },
            ] as never,
            visuals: [
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
            ] as never,
            chunk: 'Подбираю варианты',
        });

        expect(ioMock.emit).toHaveBeenCalledWith(WebSocketEvents.PROGRESS, {
            body: {
                status: 'processing',
                messageId: 'web_1',
                phase: 'results',
                quickReplies: [
                    {
                        text: 'show_all_apartments',
                        intent: 'explore_similar',
                        priority: 0.9,
                    },
                ],
                visuals: [
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
                ],
                chunk: 'Подбираю варианты',
            },
            metadata: {
                platform: 'web',
            },
        });
    });
});
