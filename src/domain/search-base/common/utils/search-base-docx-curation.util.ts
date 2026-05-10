import type {
    SearchBaseDocxQaItem,
    SearchBaseDocxQaPayload,
} from './search-base-docx-seed.util';

export const ALLOWED_MYS_SEARCH_BASE_SECTION_KEYS = [
    'object_overview',
    'sales_and_purchase',
] as const;

type AllowedMysSearchBaseSectionKey =
    (typeof ALLOWED_MYS_SEARCH_BASE_SECTION_KEYS)[number];

export interface CuratedSearchBaseDocxPayload extends SearchBaseDocxQaPayload {
    items: SearchBaseDocxQaItem[];
    curation: {
        strategy: 'allowed-sections-only';
        allowedSections: readonly AllowedMysSearchBaseSectionKey[];
        includedItems: number;
        excludedItems: number;
    };
}

export function curateMysSearchBaseDocxPayload(
    payload: SearchBaseDocxQaPayload,
): CuratedSearchBaseDocxPayload {
    const allowed = new Set<string>(ALLOWED_MYS_SEARCH_BASE_SECTION_KEYS);
    const sourceItems = Array.isArray(payload.items) ? payload.items : [];
    const items = sourceItems.filter((item) =>
        allowed.has(normalizeSectionKey(item.sectionKey)),
    );

    return {
        ...payload,
        items,
        curation: {
            strategy: 'allowed-sections-only',
            allowedSections: ALLOWED_MYS_SEARCH_BASE_SECTION_KEYS,
            includedItems: items.length,
            excludedItems: sourceItems.length - items.length,
        },
    };
}

function normalizeSectionKey(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}
