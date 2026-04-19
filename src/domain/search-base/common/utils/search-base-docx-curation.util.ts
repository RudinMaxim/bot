import type {
    SearchBaseDocxQaItem,
    SearchBaseDocxQaPayload,
} from './search-base-docx-seed.util';

export const ALLOWED_MYS_SEARCH_BASE_SECTION_KEYS = [
    'object_overview',
    'urban_blocks',
    'club_houses',
    'townhouses',
    'cottages',
    'quarter_infrastructure',
    'around_infrastructure',
    'developer_info',
    'sales_and_purchase',
] as const;

export type AllowedMysSearchBaseSectionKey =
    (typeof ALLOWED_MYS_SEARCH_BASE_SECTION_KEYS)[number];

export interface CuratedSearchBaseDocxQaPayload extends SearchBaseDocxQaPayload {
    readonly curation?: {
        readonly strategy: 'allowed-sections-only';
        readonly allowedSections: readonly AllowedMysSearchBaseSectionKey[];
        readonly includedItems: number;
        readonly excludedItems: number;
    };
}

const ALLOWED_SECTION_KEY_SET = new Set<string>(
    ALLOWED_MYS_SEARCH_BASE_SECTION_KEYS,
);

export function curateMysSearchBaseDocxPayload(
    payload: SearchBaseDocxQaPayload,
): CuratedSearchBaseDocxQaPayload {
    const items = Array.isArray(payload.items) ? payload.items : [];
    const curatedItems = items.filter((item) => isAllowedItem(item));

    return {
        ...payload,
        items: curatedItems,
        curation: {
            strategy: 'allowed-sections-only',
            allowedSections: ALLOWED_MYS_SEARCH_BASE_SECTION_KEYS,
            includedItems: curatedItems.length,
            excludedItems: Math.max(0, items.length - curatedItems.length),
        },
    };
}

function isAllowedItem(item: SearchBaseDocxQaItem): boolean {
    return (
        typeof item.sectionKey === 'string' &&
        ALLOWED_SECTION_KEY_SET.has(item.sectionKey)
    );
}
