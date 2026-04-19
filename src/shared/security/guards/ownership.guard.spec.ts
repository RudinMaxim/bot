import { OwnershipGuard } from './ownership.guard';
import { IdentityService } from '../services/identity.service';
import {
    ChatNotOwnedError,
    ChatOwnershipService,
} from '../services/chat-ownership.service';
import { Reflector } from '@nestjs/core';
import {
    BadRequestException,
    ExecutionContext,
    ForbiddenException,
    UnauthorizedException,
} from '@nestjs/common';
import { OWNS_CHAT_KEY } from '../security.constants';
import type { OwnsChatOptions } from '../decorators/owns-chat.decorator';

const makeCtx = (req: unknown): ExecutionContext =>
    ({
        switchToHttp: () => ({ getRequest: () => req }),
        getHandler: () => 'handler',
        getClass: () => 'class',
    }) as unknown as ExecutionContext;

const identity = {
    sessionId: 'sess-1',
    source: 'cookie' as const,
    issuedAt: 0,
};

describe('OwnershipGuard', () => {
    let identityService: jest.Mocked<Pick<IdentityService, 'resolve'>>;
    let chatOwnership: jest.Mocked<Pick<ChatOwnershipService, 'assertOwned'>>;
    let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;
    let guard: OwnershipGuard;

    const arm = (options: OwnsChatOptions): void => {
        reflector.getAllAndOverride.mockReturnValueOnce(options);
    };

    beforeEach(() => {
        identityService = { resolve: jest.fn().mockReturnValue(identity) };
        chatOwnership = {
            assertOwned: jest.fn().mockResolvedValue(undefined),
        };
        reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) };
        guard = new OwnershipGuard(
            reflector as unknown as Reflector,
            identityService as unknown as IdentityService,
            chatOwnership as unknown as ChatOwnershipService,
        );
    });

    it('is inert on handlers without @OwnsChat metadata', async () => {
        const ctx = makeCtx({ headers: {} });
        await expect(guard.canActivate(ctx)).resolves.toBe(true);
        expect(chatOwnership.assertOwned).not.toHaveBeenCalled();
        expect(identityService.resolve).not.toHaveBeenCalled();
    });

    it('reads chatId from query', async () => {
        arm({ source: 'query', name: 'chatId' });
        const req = { headers: {}, query: { chatId: 'chat_a' } };
        await expect(guard.canActivate(makeCtx(req))).resolves.toBe(true);
        expect(chatOwnership.assertOwned).toHaveBeenCalledWith(
            'chat_a',
            'sess-1',
        );
    });

    it('reads chatId from param', async () => {
        arm({ source: 'param', name: 'chatId' });
        const req = { headers: {}, params: { chatId: 'chat_b' } };
        await expect(guard.canActivate(makeCtx(req))).resolves.toBe(true);
        expect(chatOwnership.assertOwned).toHaveBeenCalledWith(
            'chat_b',
            'sess-1',
        );
    });

    it('reads chatId from a dotted body path', async () => {
        arm({ source: 'body', name: 'body.chatId' });
        const req = { headers: {}, body: { body: { chatId: 'chat_c' } } };
        await expect(guard.canActivate(makeCtx(req))).resolves.toBe(true);
        expect(chatOwnership.assertOwned).toHaveBeenCalledWith(
            'chat_c',
            'sess-1',
        );
    });

    it('parses chatId out of a feedbackKey', async () => {
        arm({ source: 'feedbackKey', name: 'key' });
        const req = { headers: {}, body: { key: 'chat_d:msg-9' } };
        await expect(guard.canActivate(makeCtx(req))).resolves.toBe(true);
        expect(chatOwnership.assertOwned).toHaveBeenCalledWith(
            'chat_d',
            'sess-1',
        );
    });

    it('prefers identity already attached to req', async () => {
        arm({ source: 'query', name: 'chatId' });
        const preset = { ...identity, sessionId: 'sess-pre' };
        const req = {
            headers: {},
            query: { chatId: 'chat_a' },
            identity: preset,
        };
        await expect(guard.canActivate(makeCtx(req))).resolves.toBe(true);
        expect(identityService.resolve).not.toHaveBeenCalled();
        expect(chatOwnership.assertOwned).toHaveBeenCalledWith(
            'chat_a',
            'sess-pre',
        );
    });

    it('throws UnauthorizedException(NO_IDENTITY) when identity is missing', async () => {
        arm({ source: 'query', name: 'chatId' });
        identityService.resolve.mockReturnValueOnce(null);
        const ctx = makeCtx({ headers: {}, query: { chatId: 'chat_a' } });
        await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
            UnauthorizedException,
        );
    });

    it('throws BadRequestException(BAD_CHAT_ID) when chatId is missing', async () => {
        arm({ source: 'query', name: 'chatId' });
        const ctx = makeCtx({ headers: {}, query: {} });
        await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
            BadRequestException,
        );
    });

    it('throws BadRequestException for a malformed feedbackKey', async () => {
        arm({ source: 'feedbackKey', name: 'key' });
        const ctx = makeCtx({ headers: {}, body: { key: 'no-colon' } });
        await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
            BadRequestException,
        );
    });

    it('throws ForbiddenException(CHAT_NOT_OWNED) on ownership mismatch', async () => {
        arm({ source: 'query', name: 'chatId' });
        chatOwnership.assertOwned.mockRejectedValueOnce(
            new ChatNotOwnedError('chat_a', 'sess-1'),
        );
        const ctx = makeCtx({ headers: {}, query: { chatId: 'chat_a' } });
        await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
            ForbiddenException,
        );
    });

    it('reads OWNS_CHAT_KEY from handler and class scope', async () => {
        arm({ source: 'query', name: 'chatId' });
        const ctx = makeCtx({ headers: {}, query: { chatId: 'chat_a' } });
        await guard.canActivate(ctx);
        expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
            OWNS_CHAT_KEY,
            ['handler', 'class'],
        );
    });
});
