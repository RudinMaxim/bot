/**
 * Coerce unknown value to a finite number. Returns 0 for non-numeric or non-finite input.
 */
export function toFiniteNumber(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Safe error message extraction from unknown error types.
 */
export function extractErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return String(error);
}

/**
 * Estimate token count from text length (approximation: 1 token ≈ 3.5 chars).
 */
export function estimateTokens(text: string): number {
    return Math.ceil(text.length / 3.5);
}

/**
 * Truncate text at the nearest word boundary within maxLength, appending "...".
 */
export function truncateAtWord(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) return text;

    const truncated = text.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > maxLength * 0.7) {
        return truncated.slice(0, lastSpace).trim() + '...';
    }

    return truncated.trim() + '...';
}
