import { SessionBootstrapController } from './session-bootstrap.controller';
import {
    IdentityService,
    IssuedIdentity,
} from '../services/identity.service';
import { ChatOwnershipService } from '../services/chat-ownership.service';
import type { Identity } from '../types/identity.types';

describe('SessionBootstrapController', () => {
    const baseIssued: IssuedIdentity = {
        sessionId: 'sess-1',
        chatId: 'chat_test-uuid',
        cookieName: 'dai_sid',
        cookieValue: 'sess-1.sig',
        cookieOptions: {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 86_400_000,
            domain: undefined,
            path: '/',
        },
        jwt: 'jwt-token',
    };

    let identityService: jest.Mocked<
        Pick<IdentityService, 'issue' | 'reissue' | 'resolve'>
    >;
    let chatOwnership: jest.Mocked<
        Pick<ChatOwnershipService, 'bind' | 'getChatIdBySession'>
    >;
    let controller: SessionBootstrapController;
    let res: { cookie: jest.Mock };
    let req: { headers: Record<string, string | undefined> };

    beforeEach(() => {
        identityService = {
            issue: jest.fn().mockReturnValue(structuredClone(baseIssued)),
            reissue: jest.fn().mockReturnValue(structuredClone(baseIssued)),
            resolve: jest.fn().mockReturnValue(null),
        };
        chatOwnership = {
            bind: jest.fn().mockResolvedValue(undefined),
            getChatIdBySession: jest.fn().mockResolvedValue(null),
        };
        controller = new SessionBootstrapController(
            identityService as unknown as IdentityService,
            chatOwnership as unknown as ChatOwnershipService,
        );
        res = { cookie: jest.fn() };
        req = { headers: { host: 'developer-ai.docker.only.com.ru' } };
    });

    it('sets the signed cookie with configured options', async () => {
        await controller.bootstrap(req as any, res as any);
        expect(res.cookie).toHaveBeenCalledWith(
            'dai_sid',
            'sess-1.sig',
            baseIssued.cookieOptions,
        );
    });

    it('returns sessionId, chatId, jwt, and expiresInSec', async () => {
        const body = await controller.bootstrap(req as any, res as any);
        expect(body).toEqual({
            sessionId: 'sess-1',
            chatId: 'chat_test-uuid',
            jwt: 'jwt-token',
            expiresInSec: 86_400,
        });
    });

    it('binds the chatId to the sessionId in Redis with the cookie TTL', async () => {
        await controller.bootstrap(req as any, res as any);
        expect(chatOwnership.bind).toHaveBeenCalledWith(
            'chat_test-uuid',
            'sess-1',
            86_400,
        );
    });

    it('reuses the existing session and chatId when the request already has a valid cookie', async () => {
        const existingIdentity: Identity = {
            sessionId: 'sess-1',
            source: 'cookie',
            issuedAt: 1,
        };
        identityService.resolve.mockReturnValue(existingIdentity);
        chatOwnership.getChatIdBySession.mockResolvedValue('chat_test-uuid');

        const body = await controller.bootstrap(req as any, res as any);

        expect(identityService.resolve).toHaveBeenCalledWith(req);
        expect(chatOwnership.getChatIdBySession).toHaveBeenCalledWith('sess-1');
        expect(identityService.reissue).toHaveBeenCalledWith(
            'sess-1',
            'chat_test-uuid',
        );
        expect(identityService.issue).not.toHaveBeenCalled();
        expect(body).toEqual({
            sessionId: 'sess-1',
            chatId: 'chat_test-uuid',
            jwt: 'jwt-token',
            expiresInSec: 86_400,
        });
    });

    it('does not set the cookie if the ownership bind throws', async () => {
        chatOwnership.bind.mockRejectedValueOnce(new Error('redis down'));
        await expect(controller.bootstrap(req as any, res as any)).rejects.toThrow(
            'redis down',
        );
        expect(res.cookie).not.toHaveBeenCalled();
    });

    it('drops cookie domain when it does not match the current request host', async () => {
        req.headers.host = 'developer-ai.neth-dev.only.digital';

        await controller.bootstrap(req as any, res as any);

        expect(res.cookie).toHaveBeenCalledWith(
            'dai_sid',
            'sess-1.sig',
            {
                ...baseIssued.cookieOptions,
                domain: undefined,
            },
        );
    });
});
