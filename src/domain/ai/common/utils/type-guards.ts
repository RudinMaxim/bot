import type {
    SearchAgentResponse,
} from '../../agents';

export function isSearchAgentResponse(
    value: unknown,
): value is SearchAgentResponse {
    return (
        !!value &&
        typeof value === 'object' &&
        Array.isArray((value as Record<string, unknown>).searchResults)
    );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Check if any of the candidates appear in the issues list */
export function hasAnyIssue(
    issues: ReadonlyArray<string>,
    candidates: ReadonlyArray<string>,
): boolean {
    const set = new Set(issues);
    return candidates.some((c) => set.has(c));
}
