import { quoteIdent } from './quote-ident';

describe('quoteIdent', () => {
    it('quotes simple identifiers', () => {
        expect(quoteIdent('id')).toBe('"id"');
        expect(quoteIdent('created_at')).toBe('"created_at"');
        expect(quoteIdent('_private')).toBe('"_private"');
        expect(quoteIdent('Foo123')).toBe('"Foo123"');
    });

    it('rejects identifiers starting with a digit', () => {
        expect(() => quoteIdent('1column')).toThrow(/Invalid SQL identifier/);
    });

    it('rejects identifiers containing spaces', () => {
        expect(() => quoteIdent('user name')).toThrow(/Invalid SQL identifier/);
    });

    it('rejects identifiers containing dashes or quotes', () => {
        expect(() => quoteIdent('user-name')).toThrow(/Invalid SQL identifier/);
        expect(() => quoteIdent('a"b')).toThrow(/Invalid SQL identifier/);
        expect(() => quoteIdent("a'b")).toThrow(/Invalid SQL identifier/);
    });

    it('rejects classic SQL injection payloads', () => {
        expect(() => quoteIdent("'); DROP TABLE users; --")).toThrow(
            /Invalid SQL identifier/,
        );
        expect(() => quoteIdent('id; DELETE FROM x')).toThrow(
            /Invalid SQL identifier/,
        );
        expect(() => quoteIdent('id\u0000extra')).toThrow(
            /Invalid SQL identifier/,
        );
    });

    it('rejects empty / non-string input', () => {
        expect(() => quoteIdent('')).toThrow(/Invalid SQL identifier/);
        // @ts-expect-error — runtime check
        expect(() => quoteIdent(undefined)).toThrow(/Invalid SQL identifier/);
        // @ts-expect-error — runtime check
        expect(() => quoteIdent(null)).toThrow(/Invalid SQL identifier/);
        // @ts-expect-error — runtime check
        expect(() => quoteIdent(123)).toThrow(/Invalid SQL identifier/);
    });

    it('rejects unicode lookalikes', () => {
        // Cyrillic 'a' that looks like Latin 'a'
        expect(() => quoteIdent('\u0430bc')).toThrow(/Invalid SQL identifier/);
    });
});
