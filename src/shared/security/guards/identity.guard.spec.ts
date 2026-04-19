import { IdentityGuard } from './identity.guard';
import { IdentityService } from '../services/identity.service';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../security.constants';

const makeCtx = (req: unknown): ExecutionContext =>
    ({
        switchToHttp: () => ({ getRequest: () => req }),
        getHandler: () => 'handler',
        getClass: () => 'class',
    }) as unknown as ExecutionContext;

describe('IdentityGuard', () => {
    let identityService: jest.Mocked<Pick<IdentityService, 'resolve'>>;
    let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;
    let guard: IdentityGuard;

    beforeEach(() => {
        identityService = { resolve: jest.fn() };
        reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
        guard = new IdentityGuard(
            identityService as unknown as IdentityService,
            reflector as unknown as Reflector,
        );
    });

    it('allows public routes without identity', () => {
        reflector.getAllAndOverride.mockReturnValueOnce(true);
        const req = { headers: {} };
        expect(guard.canActivate(makeCtx(req))).toBe(true);
        expect(identityService.resolve).not.toHaveBeenCalled();
    });

    it('reads IS_PUBLIC_KEY from handler and class', () => {
        reflector.getAllAndOverride.mockReturnValueOnce(true);
        const ctx = makeCtx({ headers: {} });
        guard.canActivate(ctx);
        expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
            IS_PUBLIC_KEY,
            ['handler', 'class'],
        );
    });

    it('attaches identity to req on success', () => {
        const identity = {
            sessionId: 'sess-1',
            source: 'cookie' as const,
            issuedAt: 0,
        };
        identityService.resolve.mockReturnValueOnce(identity);
        const req: { headers: Record<string, string>; identity?: unknown } = {
            headers: {},
        };
        const ctx = makeCtx(req);
        expect(guard.canActivate(ctx)).toBe(true);
        expect(req.identity).toBe(identity);
    });

    it('throws UnauthorizedException when identity cannot be resolved', () => {
        identityService.resolve.mockReturnValueOnce(null);
        const ctx = makeCtx({ headers: {} });
        expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('UnauthorizedException carries code NO_IDENTITY', () => {
        identityService.resolve.mockReturnValueOnce(null);
        const ctx = makeCtx({ headers: {} });
        try {
            guard.canActivate(ctx);
            fail('should throw');
        } catch (e) {
            expect((e as UnauthorizedException).getResponse()).toMatchObject({
                code: 'NO_IDENTITY',
            });
        }
    });
});
