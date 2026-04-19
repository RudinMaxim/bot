import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CookieSigner } from '../crypto/cookie-signer';
import { JwtSigner } from '../crypto/jwt-signer';
import type { SecurityConfig } from '../config/security.config.interface';
import type { Identity } from '../types/identity.types';

export interface IssuedIdentity {
    sessionId: string;
    /**
     * Server-issued chat thread identifier bound to the freshly minted
     * session. Returned to the widget so the client never has to invent
     * its own chatId — closes the URL `?chatId=` hijack vector documented
     * in master spec §13b W2. The mapping `chatId → sessionId` will be
     * enforced by `OwnershipGuard` in Phase 1.C.
     */
    chatId: string;
    cookieName: string;
    cookieValue: string;
    cookieOptions: {
        httpOnly: true;
        secure: boolean;
        sameSite: 'none' | 'lax' | 'strict';
        maxAge: number;
        domain: string | undefined;
        path: '/';
    };
    jwt: string;
}

interface MinimalRequest {
    headers: Record<string, string | string[] | undefined>;
}

export type IssuedCookieOptions = ReturnType<IdentityService['issue']>['cookieOptions'];

@Injectable()
export class IdentityService {
    constructor(
        private readonly config: SecurityConfig,
        private readonly cookieSigner: CookieSigner,
        private readonly jwtSigner: JwtSigner,
    ) {}

    issue(): IssuedIdentity {
        return this.buildIssuedIdentity(randomUUID(), `chat_${randomUUID()}`);
    }

    reissue(sessionId: string, chatId: string): IssuedIdentity {
        return this.buildIssuedIdentity(sessionId, chatId);
    }

    private buildIssuedIdentity(
        sessionId: string,
        chatId: string,
    ): IssuedIdentity {
        const cookieValue = this.cookieSigner.sign(sessionId);
        const jwt = this.jwtSigner.issue(sessionId);
        return {
            sessionId,
            chatId,
            cookieName: this.config.session.cookieName,
            cookieValue,
            cookieOptions: {
                httpOnly: true,
                secure: this.config.session.cookieSecure,
                sameSite: this.config.session.cookieSameSite,
                maxAge: this.config.session.cookieMaxAgeSec * 1000,
                domain: this.config.session.cookieDomain,
                path: '/',
            },
            jwt,
        };
    }

    resolve(req: MinimalRequest): Identity | null {
        const fromCookie = this.resolveCookie(req);
        if (fromCookie) return fromCookie;
        const fromJwt = this.resolveJwt(req);
        if (fromJwt) return fromJwt;
        return null;
    }

    private resolveCookie(req: MinimalRequest): Identity | null {
        const header = req.headers['cookie'];
        if (typeof header !== 'string') return null;
        const value = parseCookieHeader(header, this.config.session.cookieName);
        if (!value) return null;
        const sessionId = this.cookieSigner.verify(value);
        if (!sessionId) return null;
        return {
            sessionId,
            source: 'cookie',
            issuedAt: Math.floor(Date.now() / 1000),
        };
    }

    private resolveJwt(req: MinimalRequest): Identity | null {
        const header = req.headers['authorization'];
        if (typeof header !== 'string') return null;
        const match = /^Bearer\s+(.+)$/.exec(header);
        if (!match) return null;
        const verified = this.jwtSigner.verify(match[1].trim());
        if (!verified) return null;
        return {
            sessionId: verified.sessionId,
            source: 'jwt',
            issuedAt: Math.floor(Date.now() / 1000),
        };
    }
}

function parseCookieHeader(header: string, name: string): string | null {
    const parts = header.split(';');
    for (const part of parts) {
        const eq = part.indexOf('=');
        if (eq < 0) continue;
        const k = part.slice(0, eq).trim();
        if (k !== name) continue;
        return decodeURIComponent(part.slice(eq + 1).trim());
    }
    return null;
}
