import 'reflect-metadata';

import { MessageStatus, MessageType } from '../types';
import { MessagingWidgetController } from '../../controller/messaging-widget.controller';
import { ChatOwnershipService } from 'src/shared/security/services/chat-ownership.service';
import { IdentityService } from 'src/shared/security/services/identity.service';
import { MessageService } from '../../services/message.service';
import { FollowUpResolverService } from '../../services/follow-up-resolver.service';
import { OWNS_CHAT_KEY } from 'src/shared/security/security.constants';

type CookieCall = {
    name: string;
    value: string;
    options: Record<string, unknown>;
};

function createResponse() {
    const cookies: CookieCall[] = [];
    return {
        cookies,
        cookie: jest.fn(
            (
                name: string,
                value: string,
                options: Record<string, unknown>,
            ) => {
                cookies.push({ name, value, options });
            },
        ),
    };
}

describe('MessagingWidgetController', () => {
    const issued = {
        sessionId: 'session_1',
        chatId: 'chat_1',
        cookieName: 'sid',
        cookieValue: 'signed-session',
        cookieOptions: {
            httpOnly: true as const,
            secure: false,
            sameSite: 'lax' as const,
            maxAge: 86_400_000,
            domain: undefined,
            path: '/' as const,
        },
        jwt: 'jwt',
    };

    const identityService = {
        issue: jest.fn(),
        reissue: jest.fn(),
        resolve: jest.fn(),
    };
    const chatOwnership = {
        bind: jest.fn(),
        getChatIdBySession: jest.fn(),
    };
    const messageService = {
        getMessageHistory: jest.fn(),
        handleMessage: jest.fn(),
        clearSessionAndHistory: jest.fn(),
        saveResponseFeedbackAlias: jest.fn(),
    };
    const followUpResolver = {
        resolveByQuery: jest.fn(),
    };

    let controller: MessagingWidgetController;

    beforeEach(() => {
        jest.clearAllMocks();
        identityService.issue.mockReturnValue(issued);
        identityService.reissue.mockReturnValue(issued);
        identityService.resolve.mockReturnValue(null);
        chatOwnership.bind.mockResolvedValue(undefined);
        chatOwnership.getChatIdBySession.mockResolvedValue(null);
        messageService.getMessageHistory.mockResolvedValue([]);
        followUpResolver.resolveByQuery.mockReturnValue([]);
        messageService.handleMessage.mockResolvedValue({
            status: MessageStatus.COMPLETED,
            response: 'Ответ',
            originalMessage: {
                messageId: 'message_1',
                chatId: 'chat_1',
                userId: 'session_1',
                type: MessageType.TEXT,
                content: 'Привет',
                timestamp: new Date('2026-05-10T12:00:00.000Z'),
                metadata: { platform: 'widget' },
            },
            quickReplies: [],
            metrics: { processingTimeMs: 12 },
        });
        controller = new MessagingWidgetController(
            identityService as unknown as IdentityService,
            chatOwnership as unknown as ChatOwnershipService,
            messageService as unknown as MessageService,
            {
                security: {
                    session: {
                        cookieMaxAgeSec: 86_400,
                    },
                },
            } as never,
            followUpResolver as unknown as FollowUpResolverService,
        );
    });

    it('issues a server-owned chat and session cookie on first widget load', async () => {
        const response = createResponse();

        const result = await controller.startSession(
            { headers: {} },
            response as never,
        );

        expect(identityService.issue).toHaveBeenCalledTimes(1);
        expect(chatOwnership.bind).toHaveBeenCalledWith(
            'chat_1',
            'session_1',
            86_400,
        );
        expect(response.cookie).toHaveBeenCalledWith(
            'sid',
            'signed-session',
            issued.cookieOptions,
        );
        expect(result).toEqual({ chatId: 'chat_1', messages: [] });
    });

    it('reuses the chat bound to an existing cookie session and returns history', async () => {
        identityService.resolve.mockReturnValue({
            sessionId: 'session_1',
            source: 'cookie',
            issuedAt: 1,
        });
        chatOwnership.getChatIdBySession.mockResolvedValue('chat_1');
        messageService.getMessageHistory.mockResolvedValue([
            {
                id: 'message_1',
                role: 'assistant',
                content: 'Старый ответ',
                timestamp: '2026-05-10T12:00:00.000Z',
            },
        ]);
        const response = createResponse();

        const result = await controller.startSession(
            { headers: { cookie: 'sid=signed-session' } },
            response as never,
        );

        expect(identityService.issue).not.toHaveBeenCalled();
        expect(identityService.reissue).toHaveBeenCalledWith(
            'session_1',
            'chat_1',
        );
        expect(messageService.getMessageHistory).toHaveBeenCalledWith(
            'chat_1',
            50,
        );
        expect(result.messages).toHaveLength(1);
    });

    it('marks message submission as requiring ownership by body chatId', () => {
        const metadata = Reflect.getMetadata(
            OWNS_CHAT_KEY,
            controller.sendMessage,
        );

        expect(metadata).toEqual({ source: 'body', name: 'chatId' });
    });

    it('delegates text messages to MessageService and returns assistant response', async () => {
        const result = await controller.sendMessage(
            {
                chatId: 'chat_1',
                content: 'Привет',
            },
            {
                headers: {},
                identity: {
                    sessionId: 'session_1',
                    source: 'cookie',
                    issuedAt: 1,
                },
            },
        );

        expect(messageService.handleMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                chatId: 'chat_1',
                userId: 'session_1',
                type: MessageType.TEXT,
                content: 'Привет',
                metadata: expect.objectContaining({
                    platform: 'widget',
                    locale: 'ru',
                }),
            }),
        );
        expect(result).toEqual(
            expect.objectContaining({
                chatId: 'chat_1',
                response: 'Ответ',
                status: MessageStatus.COMPLETED,
            }),
        );
    });

    it('serves embeddable JavaScript and plain CSS assets', () => {
        expect(controller.widgetScript()).toContain('data-messaging-widget');
        expect(controller.widgetScript()).toContain('postJson("/session")');
        expect(controller.widgetStyles()).toContain('.pgmu-widget');
        expect(controller.widgetStyles()).toContain('--pgmu-crimson');
    });

    it('serves a standalone demo page that mounts the widget full screen', () => {
        const html = controller.demoPage();

        expect(html).toContain('<!doctype html>');
        expect(html).toContain('<title>ФАЦ ПГМУ чат</title>');
        expect(html).toContain('id="pgmu-demo-widget"');
        expect(html).toContain('src="./widget.js"');
        expect(html).toContain('data-container="#pgmu-demo-widget"');
        expect(html).toContain('height: 100dvh;');
        expect(html).not.toContain('pgmu-widget__toggle');
    });

    it('serves an always-open full-area widget without a launcher toggle', () => {
        expect(controller.widgetScript()).not.toContain(
            'pgmu-widget__toggle',
        );
        expect(controller.widgetScript()).not.toContain('data-role="toggle"');
        expect(controller.widgetScript()).not.toContain('pgmu-widget--open');
        expect(controller.widgetStyles()).not.toContain(
            '.pgmu-widget__toggle',
        );
        expect(controller.widgetStyles()).not.toContain(
            '.pgmu-widget--open',
        );
        expect(controller.widgetStyles()).not.toContain('position: fixed;');
        expect(controller.widgetStyles()).toContain('width: 100%;');
        expect(controller.widgetStyles()).toContain('height: 100%;');
        expect(controller.widgetStyles()).toContain('#b5121b');
        expect(controller.widgetStyles()).toContain('Montserrat');
        expect(controller.widgetStyles()).toContain('Open Sans');
    });

    it('serves accessible markup for an embedded chat surface', () => {
        const script = controller.widgetScript();

        expect(script).toContain('role="region"');
        expect(script).toContain('role="log"');
        expect(script).toContain('aria-live="polite"');
        expect(script).toContain('aria-relevant="additions text"');
        expect(script).toContain('aria-controls="pgmu-widget-menu"');
        expect(script).toContain('id="pgmu-widget-input-label"');
        expect(script).toContain('aria-labelledby="pgmu-widget-input-label"');
        expect(script).toContain('root.setAttribute("lang"');
        expect(script).toContain('send.setAttribute("aria-disabled"');
    });

    it('refreshes locale-specific chat chrome immediately after language switch', () => {
        const script = controller.widgetScript();

        expect(script).toContain('window.localStorage.setItem(localeKey, locale)');
        expect(script).toContain('resetMessagesUi(root);');
        expect(script).toContain('appendWelcome(root);');
        expect(script).toContain('root.dataset.locale = state.locale;');
        expect(script).toContain('postJson("/messages", { chatId: state.chatId, content: content, locale: state.locale })');
    });

    it('serves responsive and motion-aware widget styling', () => {
        const css = controller.widgetStyles();

        expect(css).toContain('container-type: inline-size;');
        expect(css).toContain('@container (max-width: 420px)');
        expect(css).toContain('@media (max-width: 480px)');
        expect(css).toContain('@media (prefers-reduced-motion: reduce)');
        expect(css).toContain('transition: opacity 0.16s ease, transform 0.16s ease');
        expect(css).toContain('.pgmu-widget__sr-only');
        expect(css).toContain('.pgmu-widget__hint { display: none; }');
    });

    it('serves auto theme detection and dark theme styling', () => {
        const script = controller.widgetScript();
        const css = controller.widgetStyles();

        expect(script).toContain('matchMedia("(prefers-color-scheme: dark)")');
        expect(script).toContain('applyTheme(root)');
        expect(script).toContain('themeMedia.addEventListener("change"');
        expect(script).toContain('root.dataset.theme = isDarkTheme() ? "dark" : "light";');
        expect(css).toContain('color-scheme: light dark;');
        expect(css).toContain('.pgmu-widget[data-theme="dark"]');
    });

    it('serves a styled loading state before CSS and content are ready', () => {
        const script = controller.widgetScript();
        const css = controller.widgetStyles();

        expect(script).toContain('data-messaging-widget="boot-styles"');
        expect(script).toContain('root.dataset.loading = "true";');
        expect(script).toContain('pgmu-widget__loader');
        expect(script).toContain('setLoading(root, false);');
        expect(css).toContain('.pgmu-widget[data-loading="true"] .pgmu-widget__panel');
        expect(css).toContain('.pgmu-widget__loader');
    });

    it('renders the menu button as a vertical control aligned with the input', () => {
        const css = controller.widgetStyles();

        expect(css).toContain('height: var(--pgmu-input-min-height);');
        expect(css).toContain('border-radius: var(--pgmu-radius);');
        expect(css).toContain("cy='5'");
        expect(css).toContain("cy='12'");
        expect(css).toContain("cy='19'");
        expect(css).not.toContain("cx='5' cy='12'");
    });

    it('hides keyboard shortcut hints on touch-oriented devices', () => {
        const css = controller.widgetStyles();

        expect(css).toContain('@media (hover: none), (pointer: coarse)');
        expect(css).toContain('.pgmu-widget__hint { display: none; }');
    });
});
