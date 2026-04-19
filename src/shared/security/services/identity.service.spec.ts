import { IdentityService } from './identity.service';
import { CookieSigner } from '../crypto/cookie-signer';
import { JwtSigner } from '../crypto/jwt-signer';
import { SecurityConfig } from '../config/security.config.interface';

const makeCfg = (): SecurityConfig => ({
    session: {
        signingKey: 'test-key-min-32-bytes-xxxxxxxxxxxx',
        cookieName: 'dai_sid',
        cookieDomain: undefined,
        cookieMaxAgeSec: 86400,
        cookieSameSite: 'none',
        cookieSecure: true,
    },
    jwt: {
        signingKey: 'test-key-min-32-bytes-xxxxxxxxxxxx',
        ttlSec: 3600,
        issuer: 'test',
    },
    ban: { defaultTtlSec: 3600 },
    integration: { apiKeys: [] },
});

const makeService = () => {
    const cfg = makeCfg();
    const cookieSigner = new CookieSigner(cfg.session.signingKey);
    const jwtSigner = new JwtSigner({
        key: cfg.jwt.signingKey,
        ttlSec: cfg.jwt.ttlSec,
        issuer: cfg.jwt.issuer,
    });
    return { service: new IdentityService(cfg, cookieSigner, jwtSigner), cfg };
};

describe('IdentityService', () => {
    describe('issue()', () => {
        it('returns a fresh sessionId, signed cookie value, and jwt', () => {
            const { service } = makeService();
            const issued = service.issue();
            expect(issued.sessionId).toMatch(/^[0-9a-f-]{36}$/);
            expect(issued.cookieValue).toContain(issued.sessionId + '.');
            expect(issued.jwt.split('.').length).toBe(3);
        });

        it('returns a fresh server-issued chatId bound to the session', () => {
            const { service } = makeService();
            const a = service.issue();
            const b = service.issue();
            expect(a.chatId).toMatch(/^chat_[0-9a-f-]{36}$/);
            expect(b.chatId).toMatch(/^chat_[0-9a-f-]{36}$/);
            // Two separate calls produce two distinct chatIds — guarantees
            // the client can never get a thread that already belongs to
            // somebody else just by hitting bootstrap twice.
            expect(a.chatId).not.toBe(b.chatId);
            expect(a.sessionId).not.toBe(b.sessionId);
        });

        it('returns cookie options derived from config', () => {
            const { service, cfg } = makeService();
            const issued = service.issue();
            expect(issued.cookieOptions).toEqual({
                httpOnly: true,
                secure: cfg.session.cookieSecure,
                sameSite: cfg.session.cookieSameSite,
                maxAge: cfg.session.cookieMaxAgeSec * 1000,
                domain: cfg.session.cookieDomain,
                path: '/',
            });
        });

        it('reissues the same sessionId and chatId when requested explicitly', () => {
            const { service } = makeService();
            const issued = service.reissue(
                'sess_existing',
                'chat_existing',
            );

            expect(issued.sessionId).toBe('sess_existing');
            expect(issued.chatId).toBe('chat_existing');
            expect(issued.cookieValue).toContain('sess_existing.');
            expect(issued.jwt.split('.').length).toBe(3);
        });
    });

    describe('resolve()', () => {
        it('resolves identity from a valid signed cookie', () => {
            const { service } = makeService();
            const issued = service.issue();
            const req = {
                headers: { cookie: `dai_sid=${issued.cookieValue}` },
            };
            const identity = service.resolve(req);
            expect(identity).toEqual({
                sessionId: issued.sessionId,
                source: 'cookie',
                issuedAt: expect.any(Number),
            });
        });

        it('falls back to Authorization Bearer JWT if no cookie', () => {
            const { service } = makeService();
            const issued = service.issue();
            const req = {
                headers: { authorization: `Bearer ${issued.jwt}` },
            };
            const identity = service.resolve(req);
            expect(identity?.sessionId).toBe(issued.sessionId);
            expect(identity?.source).toBe('jwt');
        });

        it('prefers cookie over jwt when both present', () => {
            const { service } = makeService();
            const a = service.issue();
            const b = service.issue();
            const req = {
                headers: {
                    cookie: `dai_sid=${a.cookieValue}`,
                    authorization: `Bearer ${b.jwt}`,
                },
            };
            const identity = service.resolve(req);
            expect(identity?.sessionId).toBe(a.sessionId);
            expect(identity?.source).toBe('cookie');
        });

        it('returns null if no credentials', () => {
            const { service } = makeService();
            expect(service.resolve({ headers: {} })).toBeNull();
        });

        it('returns null if cookie signature invalid', () => {
            const { service } = makeService();
            const req = {
                headers: { cookie: 'dai_sid=sess-1.bad-sig' },
            };
            expect(service.resolve(req)).toBeNull();
        });

        it('returns null if JWT invalid', () => {
            const { service } = makeService();
            const req = {
                headers: { authorization: 'Bearer not.a.jwt' },
            };
            expect(service.resolve(req)).toBeNull();
        });

        it('ignores other cookies when parsing Cookie header', () => {
            const { service } = makeService();
            const issued = service.issue();
            const req = {
                headers: {
                    cookie: `other=foo; dai_sid=${issued.cookieValue}; another=bar`,
                },
            };
            expect(service.resolve(req)?.sessionId).toBe(issued.sessionId);
        });
    });
});
