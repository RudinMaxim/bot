import type { NextFunction, Request, Response } from 'express';
import { createBasicAuthMiddleware } from './basic-auth.middleware';

interface MockRes {
    statusCode: number;
    headers: Record<string, string>;
    body: string | undefined;
    setHeader: (name: string, value: string) => void;
    status: (code: number) => MockRes;
    send: (body: string) => void;
}

const makeRes = (): MockRes => {
    const res: MockRes = {
        statusCode: 0,
        headers: {},
        body: undefined,
        setHeader(name, value) {
            this.headers[name] = value;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        send(body) {
            this.body = body;
        },
    };
    return res;
};

const reqWith = (auth?: string): Request =>
    ({
        headers: auth ? { authorization: auth } : {},
    }) as unknown as Request;

const encode = (user: string, pass: string): string =>
    'Basic ' + Buffer.from(`${user}:${pass}`, 'utf8').toString('base64');

describe('createBasicAuthMiddleware', () => {
    const middleware = createBasicAuthMiddleware(
        'admin',
        'super-secret',
        'TestRealm',
    );
    let next: jest.MockedFunction<NextFunction>;

    beforeEach(() => {
        next = jest.fn();
    });

    it('rejects requests with no Authorization header', () => {
        const res = makeRes();
        middleware(reqWith(), res as unknown as Response, next);
        expect(res.statusCode).toBe(401);
        expect(res.headers['WWW-Authenticate']).toBe(
            'Basic realm="TestRealm", charset="UTF-8"',
        );
        expect(next).not.toHaveBeenCalled();
    });

    it('rejects requests with non-Basic scheme', () => {
        const res = makeRes();
        middleware(
            reqWith('Bearer something'),
            res as unknown as Response,
            next,
        );
        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('rejects wrong password', () => {
        const res = makeRes();
        middleware(
            reqWith(encode('admin', 'wrong-password')),
            res as unknown as Response,
            next,
        );
        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('rejects wrong user', () => {
        const res = makeRes();
        middleware(
            reqWith(encode('root', 'super-secret')),
            res as unknown as Response,
            next,
        );
        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('accepts correct credentials', () => {
        const res = makeRes();
        middleware(
            reqWith(encode('admin', 'super-secret')),
            res as unknown as Response,
            next,
        );
        expect(res.statusCode).toBe(0);
        expect(next).toHaveBeenCalledTimes(1);
    });

    it('rejects malformed base64 payload', () => {
        const res = makeRes();
        middleware(
            reqWith('Basic !!!not-base64!!!'),
            res as unknown as Response,
            next,
        );
        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('rejects empty Basic header', () => {
        const res = makeRes();
        middleware(
            reqWith('Basic '),
            res as unknown as Response,
            next,
        );
        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('uses default realm when not provided', () => {
        const mw = createBasicAuthMiddleware('u', 'p');
        const res = makeRes();
        mw(reqWith(), res as unknown as Response, next);
        expect(res.headers['WWW-Authenticate']).toBe(
            'Basic realm="Restricted", charset="UTF-8"',
        );
    });
});
