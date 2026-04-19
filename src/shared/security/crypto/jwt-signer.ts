import * as jwt from 'jsonwebtoken';

export interface JwtSignerOptions {
    key: string;
    ttlSec: number;
    issuer: string;
}

export class JwtSigner {
    constructor(private readonly opts: JwtSignerOptions) {
        if (!opts.key || opts.key.length < 16) {
            throw new Error('JwtSigner: key must be >= 16 chars');
        }
    }

    issue(sessionId: string): string {
        return jwt.sign({ sid: sessionId }, this.opts.key, {
            algorithm: 'HS256',
            expiresIn: this.opts.ttlSec,
            issuer: this.opts.issuer,
        });
    }

    verify(token: string): { sessionId: string } | null {
        if (!token) return null;
        try {
            const payload = jwt.verify(token, this.opts.key, {
                algorithms: ['HS256'],
                issuer: this.opts.issuer,
            }) as jwt.JwtPayload;
            if (typeof payload.sid !== 'string' || !payload.sid) return null;
            return { sessionId: payload.sid };
        } catch {
            return null;
        }
    }
}
