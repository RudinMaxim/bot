import { AI_STATUS } from '../constants';

/**
 * Return the first non-empty string value, or a default.
 */
export function resolveString(
    primary: unknown,
    fallback: unknown,
    defaultValue: string = AI_STATUS.UNKNOWN,
): string {
    if (typeof primary === 'string' && primary.length > 0) return primary;
    if (typeof fallback === 'string' && fallback.length > 0) return fallback;
    return defaultValue;
}

/**
 * Return the first value that is a string or number, or undefined.
 */
export function resolveStringOrNumber(
    primary: unknown,
    fallback?: unknown,
): string | number | undefined {
    if (typeof primary === 'string' || typeof primary === 'number')
        return primary;
    if (typeof fallback === 'string' || typeof fallback === 'number')
        return fallback;
    return undefined;
}

/**
 * Return a trimmed non-empty string, or undefined.
 */
export function resolveNonEmptyString(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim().length > 0) return value;
    return undefined;
}
