import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeyRegistryService } from '../services/api-key-registry.service';
import { API_KEY_AUTH_KEY } from '../security.constants';

function setupGuard(
    registryEntries: Array<{
        plain: string;
        name: string;
        role: 'admin' | 'read-only';
    }>,
): {
    guard: ApiKeyGuard;
    reflector: Reflector;
} {
    const registry = new ApiKeyRegistryService(
        registryEntries.map(({ plain, name, role }) => ({
            name,
            hash: ApiKeyRegistryService.hashKey(plain),
            role,
        })),
    );
    const reflector = new Reflector();
    const guard = new ApiKeyGuard(registry, reflector);
    return { guard, reflector };
}

function runGuard(
    guard: ApiKeyGuard,
    reflector: Reflector,
    req: { method: string; headers: Record<string, string | undefined> },
    apiKeyAuth: boolean,
): boolean {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === API_KEY_AUTH_KEY) return apiKeyAuth;
        return undefined;
    });
    const ctx = {
        switchToHttp: () => ({
            getRequest: <T>() => req as unknown as T,
        }),
        getHandler: () => null,
        getClass: () => null,
    } as unknown as ExecutionContext;
    return guard.canActivate(ctx);
}

describe('ApiKeyGuard', () => {
    it('is inert on handlers without @ApiKeyAuth metadata', () => {
        const { guard, reflector } = setupGuard([]);
        const result = runGuard(
            guard,
            reflector,
            { method: 'GET', headers: {} },
            false,
        );
        expect(result).toBe(true);
    });

    it('rejects request without X-API-Key header', () => {
        const { guard, reflector } = setupGuard([
            { plain: 'secret-admin', name: 'adm_1', role: 'admin' },
        ]);
        expect(() =>
            runGuard(
                guard,
                reflector,
                { method: 'GET', headers: {} },
                true,
            ),
        ).toThrow(UnauthorizedException);
        try {
            runGuard(guard, reflector, { method: 'GET', headers: {} }, true);
        } catch (e) {
            expect((e as UnauthorizedException).getResponse()).toMatchObject({
                code: 'API_KEY_REQUIRED',
            });
        }
    });

    it('rejects unknown API key', () => {
        const { guard, reflector } = setupGuard([
            { plain: 'secret-admin', name: 'adm_1', role: 'admin' },
        ]);
        try {
            runGuard(
                guard,
                reflector,
                { method: 'GET', headers: { 'x-api-key': 'wrong' } },
                true,
            );
            fail('expected UnauthorizedException');
        } catch (e) {
            expect(e).toBeInstanceOf(UnauthorizedException);
            expect((e as UnauthorizedException).getResponse()).toMatchObject({
                code: 'API_KEY_INVALID',
            });
        }
    });

    it('accepts read-only key on GET', () => {
        const { guard, reflector } = setupGuard([
            { plain: 'secret-ro', name: 'ro_1', role: 'read-only' },
        ]);
        const req = {
            method: 'GET',
            headers: { 'x-api-key': 'secret-ro' },
        } as {
            method: string;
            headers: Record<string, string | undefined>;
            apiKey?: unknown;
        };
        expect(runGuard(guard, reflector, req, true)).toBe(true);
        expect(req.apiKey).toEqual({ name: 'ro_1', role: 'read-only' });
    });

    it('accepts read-only key on HEAD and OPTIONS', () => {
        const { guard, reflector } = setupGuard([
            { plain: 'secret-ro', name: 'ro_1', role: 'read-only' },
        ]);
        for (const method of ['HEAD', 'OPTIONS']) {
            expect(
                runGuard(
                    guard,
                    reflector,
                    { method, headers: { 'x-api-key': 'secret-ro' } },
                    true,
                ),
            ).toBe(true);
        }
    });

    it('rejects read-only key on POST with API_KEY_FORBIDDEN', () => {
        const { guard, reflector } = setupGuard([
            { plain: 'secret-ro', name: 'ro_1', role: 'read-only' },
        ]);
        try {
            runGuard(
                guard,
                reflector,
                {
                    method: 'POST',
                    headers: { 'x-api-key': 'secret-ro' },
                },
                true,
            );
            fail('expected ForbiddenException');
        } catch (e) {
            expect(e).toBeInstanceOf(ForbiddenException);
            expect((e as ForbiddenException).getResponse()).toMatchObject({
                code: 'API_KEY_FORBIDDEN',
            });
        }
    });

    it('accepts admin key on POST / PUT / PATCH / DELETE', () => {
        const { guard, reflector } = setupGuard([
            { plain: 'secret-admin', name: 'adm_1', role: 'admin' },
        ]);
        for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
            const req = {
                method,
                headers: { 'x-api-key': 'secret-admin' },
            } as {
                method: string;
                headers: Record<string, string | undefined>;
                apiKey?: unknown;
            };
            expect(runGuard(guard, reflector, req, true)).toBe(true);
            expect(req.apiKey).toEqual({ name: 'adm_1', role: 'admin' });
        }
    });

    it('is case-insensitive on HTTP method', () => {
        const { guard, reflector } = setupGuard([
            { plain: 'secret-ro', name: 'ro_1', role: 'read-only' },
        ]);
        // Express lowercases req.method on some middlewares; guard must still
        // recognize it.
        expect(
            runGuard(
                guard,
                reflector,
                { method: 'get', headers: { 'x-api-key': 'secret-ro' } },
                true,
            ),
        ).toBe(true);
    });
});
