import {
    CORS_ALLOWED_HEADERS,
    CORS_ALLOWED_METHODS,
    CORS_PREFLIGHT_MAX_AGE_SECONDS,
    resolveCorsOptions,
} from './resolve-cors-options';

describe('resolveCorsOptions', () => {
    const baseExtras = {
        methods: [...CORS_ALLOWED_METHODS],
        allowedHeaders: [...CORS_ALLOWED_HEADERS],
        maxAge: CORS_PREFLIGHT_MAX_AGE_SECONDS,
    };

    it('disables CORS when enabled=false but still returns the policy shape', () => {
        expect(
            resolveCorsOptions({ enabled: false, origins: ['https://x'] }),
        ).toEqual({ origin: false, credentials: false, ...baseExtras });
    });

    it('forces credentials=false when origins is wildcard', () => {
        expect(resolveCorsOptions({ enabled: true, origins: '*' })).toEqual({
            origin: true,
            credentials: false,
            ...baseExtras,
        });
    });

    it('returns explicit whitelist with credentials=true', () => {
        expect(
            resolveCorsOptions({
                enabled: true,
                origins: ['https://a.example', 'https://b.example'],
            }),
        ).toEqual({
            origin: ['https://a.example', 'https://b.example'],
            credentials: true,
            ...baseExtras,
        });
    });

    it('empty origin list effectively disables CORS', () => {
        expect(resolveCorsOptions({ enabled: true, origins: [] })).toEqual({
            origin: false,
            credentials: false,
            ...baseExtras,
        });
    });

    it('always advertises POST/OPTIONS and the security headers used by the widget', () => {
        const resolved = resolveCorsOptions({
            enabled: true,
            origins: ['https://a.example'],
        });
        expect(resolved.methods).toEqual(
            expect.arrayContaining(['GET', 'POST', 'OPTIONS']),
        );
        expect(resolved.allowedHeaders).toEqual(
            expect.arrayContaining([
                'Authorization',
                'X-Api-Key',
                'X-Auth-Method',
                'X-Request-Id',
            ]),
        );
        expect(resolved.maxAge).toBe(CORS_PREFLIGHT_MAX_AGE_SECONDS);
    });
});
