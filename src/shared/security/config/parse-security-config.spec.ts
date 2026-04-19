import { parseSecurityConfig } from './parse-security-config';

const strongKey = 'a'.repeat(32);
const strongKey2 = 'b'.repeat(32);

const baseEnv = (): NodeJS.ProcessEnv => ({
    SESSION_SIGNING_KEY: strongKey,
    JWT_SIGNING_KEY: strongKey2,
    NODE_ENV: 'test',
});

describe('parseSecurityConfig', () => {
    describe('signing key strength', () => {
        it('throws when SESSION_SIGNING_KEY is missing', () => {
            expect(() =>
                parseSecurityConfig({ NODE_ENV: 'test' } as NodeJS.ProcessEnv),
            ).toThrow(/SESSION_SIGNING_KEY is required/);
        });

        it('throws when SESSION_SIGNING_KEY is shorter than 32 bytes', () => {
            expect(() =>
                parseSecurityConfig({
                    ...baseEnv(),
                    SESSION_SIGNING_KEY: 'short',
                } as NodeJS.ProcessEnv),
            ).toThrow(/at least 32 bytes/);
        });

        it('throws when JWT_SIGNING_KEY is too short', () => {
            expect(() =>
                parseSecurityConfig({
                    ...baseEnv(),
                    JWT_SIGNING_KEY: 'short',
                } as NodeJS.ProcessEnv),
            ).toThrow(/at least 32 bytes/);
        });
    });

    describe('JWT key fallback', () => {
        it('warns and falls back to SESSION_SIGNING_KEY in non-production', () => {
            const { config, warnings } = parseSecurityConfig({
                SESSION_SIGNING_KEY: strongKey,
                NODE_ENV: 'development',
            } as NodeJS.ProcessEnv);
            expect(config.jwt.signingKey).toBe(strongKey);
            expect(warnings).toHaveLength(1);
            expect(warnings[0].field).toBe('JWT_SIGNING_KEY');
        });

        it('throws in production when JWT_SIGNING_KEY is missing', () => {
            expect(() =>
                parseSecurityConfig({
                    SESSION_SIGNING_KEY: strongKey,
                    NODE_ENV: 'production',
                } as NodeJS.ProcessEnv),
            ).toThrow(/JWT_SIGNING_KEY is required in production/);
        });

        it('no warning when dedicated JWT key is provided', () => {
            const { warnings } = parseSecurityConfig(baseEnv());
            expect(warnings).toHaveLength(0);
        });
    });

    describe('cookieSameSite', () => {
        it('accepts lowercase values', () => {
            for (const v of ['none', 'lax', 'strict']) {
                const { config } = parseSecurityConfig({
                    ...baseEnv(),
                    SESSION_COOKIE_SAMESITE: v,
                    SESSION_COOKIE_SECURE: v === 'none' ? 'true' : 'false',
                } as NodeJS.ProcessEnv);
                expect(config.session.cookieSameSite).toBe(v);
            }
        });

        it('normalizes mixed case', () => {
            const { config } = parseSecurityConfig({
                ...baseEnv(),
                SESSION_COOKIE_SAMESITE: 'LAX',
                SESSION_COOKIE_SECURE: 'false',
            } as NodeJS.ProcessEnv);
            expect(config.session.cookieSameSite).toBe('lax');
        });

        it('throws on invalid value', () => {
            expect(() =>
                parseSecurityConfig({
                    ...baseEnv(),
                    SESSION_COOKIE_SAMESITE: 'yes-please',
                } as NodeJS.ProcessEnv),
            ).toThrow(/must be one of none \| lax \| strict/);
        });

        it('defaults to none', () => {
            const { config } = parseSecurityConfig(baseEnv());
            expect(config.session.cookieSameSite).toBe('none');
        });
    });

    describe('SameSite=None requires Secure', () => {
        it('throws when SameSite=none and Secure=false', () => {
            expect(() =>
                parseSecurityConfig({
                    ...baseEnv(),
                    SESSION_COOKIE_SAMESITE: 'none',
                    SESSION_COOKIE_SECURE: 'false',
                } as NodeJS.ProcessEnv),
            ).toThrow(/SESSION_COOKIE_SAMESITE=none requires SESSION_COOKIE_SECURE=true/);
        });

        it('allows SameSite=lax with Secure=false', () => {
            const { config } = parseSecurityConfig({
                ...baseEnv(),
                SESSION_COOKIE_SAMESITE: 'lax',
                SESSION_COOKIE_SECURE: 'false',
            } as NodeJS.ProcessEnv);
            expect(config.session.cookieSecure).toBe(false);
        });
    });

    describe('numeric parsing', () => {
        it('throws on non-positive integer', () => {
            expect(() =>
                parseSecurityConfig({
                    ...baseEnv(),
                    SESSION_COOKIE_MAX_AGE_SEC: '0',
                } as NodeJS.ProcessEnv),
            ).toThrow(/positive integer/);
        });

        it('uses defaults when unset', () => {
            const { config } = parseSecurityConfig(baseEnv());
            expect(config.session.cookieMaxAgeSec).toBe(86_400);
            expect(config.jwt.ttlSec).toBe(3_600);
            expect(config.ban.defaultTtlSec).toBe(3_600);
        });
    });

    describe('defaults', () => {
        it('sensible defaults for cookieName, issuer', () => {
            const { config } = parseSecurityConfig(baseEnv());
            expect(config.session.cookieName).toBe('dai_sid');
            expect(config.session.cookieDomain).toBeUndefined();
            expect(config.jwt.issuer).toBe('developer-ai');
        });
    });

    describe('INTEGRATION_API_KEYS', () => {
        const validHash = 'a'.repeat(64);
        const validHash2 = 'b'.repeat(64);

        it('defaults to empty array when unset', () => {
            const { config, warnings } = parseSecurityConfig(baseEnv());
            expect(config.integration.apiKeys).toEqual([]);
            expect(
                warnings.find(
                    (w) => w.field === 'INTEGRATION_API_KEYS',
                ),
            ).toBeUndefined();
        });

        it('warns (but does not throw) when empty in production', () => {
            const { config, warnings } = parseSecurityConfig({
                SESSION_SIGNING_KEY: strongKey,
                JWT_SIGNING_KEY: strongKey2,
                NODE_ENV: 'production',
                SESSION_COOKIE_SECURE: 'true',
            } as NodeJS.ProcessEnv);
            expect(config.integration.apiKeys).toEqual([]);
            expect(
                warnings.some(
                    (w) => w.field === 'INTEGRATION_API_KEYS',
                ),
            ).toBe(true);
        });

        it('parses a single admin entry', () => {
            const { config } = parseSecurityConfig({
                ...baseEnv(),
                INTEGRATION_API_KEYS: `adm_1:${validHash}:admin`,
            } as NodeJS.ProcessEnv);
            expect(config.integration.apiKeys).toEqual([
                { name: 'adm_1', hash: validHash, role: 'admin' },
            ]);
        });

        it('parses multiple comma-separated entries', () => {
            const { config } = parseSecurityConfig({
                ...baseEnv(),
                INTEGRATION_API_KEYS: `adm_1:${validHash}:admin,ro_1:${validHash2}:read-only`,
            } as NodeJS.ProcessEnv);
            expect(config.integration.apiKeys).toHaveLength(2);
            expect(config.integration.apiKeys[1].role).toBe('read-only');
        });

        it('throws on malformed entry (wrong field count)', () => {
            expect(() =>
                parseSecurityConfig({
                    ...baseEnv(),
                    INTEGRATION_API_KEYS: `adm_1:${validHash}`,
                } as NodeJS.ProcessEnv),
            ).toThrow(/expected "name:sha256hex:role"/);
        });

        it('throws on empty name', () => {
            expect(() =>
                parseSecurityConfig({
                    ...baseEnv(),
                    INTEGRATION_API_KEYS: `:${validHash}:admin`,
                } as NodeJS.ProcessEnv),
            ).toThrow(/name must not be empty/);
        });

        it('throws on invalid hash length', () => {
            expect(() =>
                parseSecurityConfig({
                    ...baseEnv(),
                    INTEGRATION_API_KEYS: `adm_1:notahash:admin`,
                } as NodeJS.ProcessEnv),
            ).toThrow(/64 lowercase hex/);
        });

        it('throws on unknown role', () => {
            expect(() =>
                parseSecurityConfig({
                    ...baseEnv(),
                    INTEGRATION_API_KEYS: `adm_1:${validHash}:root`,
                } as NodeJS.ProcessEnv),
            ).toThrow(/role must be admin \| read-only/);
        });

        it('throws on duplicate hashes', () => {
            expect(() =>
                parseSecurityConfig({
                    ...baseEnv(),
                    INTEGRATION_API_KEYS: `adm_1:${validHash}:admin,adm_2:${validHash}:admin`,
                } as NodeJS.ProcessEnv),
            ).toThrow(/duplicate hash/);
        });

        it('skips blank entries between commas', () => {
            const { config } = parseSecurityConfig({
                ...baseEnv(),
                INTEGRATION_API_KEYS: `adm_1:${validHash}:admin,,,`,
            } as NodeJS.ProcessEnv);
            expect(config.integration.apiKeys).toHaveLength(1);
        });
    });
});
