import {
    toFiniteNumber,
    extractErrorMessage,
    estimateTokens,
    truncateAtWord,
} from './ai.utils';

describe('toFiniteNumber', () => {
    it('returns the number when given a finite number', () => {
        expect(toFiniteNumber(42)).toBe(42);
        expect(toFiniteNumber(0)).toBe(0);
        expect(toFiniteNumber(-3.14)).toBe(-3.14);
    });

    it('returns 0 for non-numeric values', () => {
        expect(toFiniteNumber(undefined)).toBe(0);
        expect(toFiniteNumber(null)).toBe(0);
        expect(toFiniteNumber('42')).toBe(0);
        expect(toFiniteNumber({})).toBe(0);
        expect(toFiniteNumber(true)).toBe(0);
    });

    it('returns 0 for non-finite numbers', () => {
        expect(toFiniteNumber(NaN)).toBe(0);
        expect(toFiniteNumber(Infinity)).toBe(0);
        expect(toFiniteNumber(-Infinity)).toBe(0);
    });
});

describe('extractErrorMessage', () => {
    it('returns message from Error instance', () => {
        expect(extractErrorMessage(new Error('test error'))).toBe(
            'test error',
        );
    });

    it('returns string directly', () => {
        expect(extractErrorMessage('string error')).toBe('string error');
    });

    it('converts other types to string', () => {
        expect(extractErrorMessage(42)).toBe('42');
        expect(extractErrorMessage(null)).toBe('null');
        expect(extractErrorMessage(undefined)).toBe('undefined');
    });
});

describe('estimateTokens', () => {
    it('estimates tokens from text length', () => {
        expect(estimateTokens('hello')).toBe(Math.ceil(5 / 3.5));
        expect(estimateTokens('')).toBe(0);
    });

    it('rounds up', () => {
        const text = 'a'.repeat(10);
        expect(estimateTokens(text)).toBe(Math.ceil(10 / 3.5));
    });
});

describe('truncateAtWord', () => {
    it('returns text as-is when within limit', () => {
        expect(truncateAtWord('short text', 100)).toBe('short text');
    });

    it('returns empty/falsy text as-is', () => {
        expect(truncateAtWord('', 10)).toBe('');
    });

    it('truncates at word boundary when possible', () => {
        const text = 'one two three four five six seven';
        const result = truncateAtWord(text, 15);
        expect(result).toBe('one two three...');
    });

    it('truncates without word boundary when last space is too early', () => {
        const text = 'a ' + 'b'.repeat(30);
        const result = truncateAtWord(text, 20);
        expect(result.endsWith('...')).toBe(true);
        expect(result.length).toBeLessThanOrEqual(23);
    });
});
