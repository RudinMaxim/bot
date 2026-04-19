import { JwtSigner } from './jwt-signer';

describe('JwtSigner', () => {
    const signer = new JwtSigner({
        key: 'test-jwt-key-min-32-bytes-xxxxxxxxxxxx',
        ttlSec: 60,
        issuer: 'test',
    });

    it('issues a JWT that contains the sessionId and can be verified', () => {
        const token = signer.issue('sess-1');
        const result = signer.verify(token);
        expect(result).toEqual({ sessionId: 'sess-1' });
    });

    it('rejects a token signed with a different key', () => {
        const other = new JwtSigner({
            key: 'other-jwt-key-min-32-bytes-yyyyyyyyyyyy',
            ttlSec: 60,
            issuer: 'test',
        });
        const token = other.issue('sess-1');
        expect(signer.verify(token)).toBeNull();
    });

    it('rejects a malformed token', () => {
        expect(signer.verify('not.a.jwt')).toBeNull();
        expect(signer.verify('')).toBeNull();
    });

    it('rejects a token with a different issuer', () => {
        const other = new JwtSigner({
            key: 'test-jwt-key-min-32-bytes-xxxxxxxxxxxx',
            ttlSec: 60,
            issuer: 'other',
        });
        const token = other.issue('sess-1');
        expect(signer.verify(token)).toBeNull();
    });

    it('rejects an expired token', () => {
        const shortLived = new JwtSigner({
            key: 'test-jwt-key-min-32-bytes-xxxxxxxxxxxx',
            ttlSec: -1,
            issuer: 'test',
        });
        const token = shortLived.issue('sess-1');
        expect(signer.verify(token)).toBeNull();
    });
});
