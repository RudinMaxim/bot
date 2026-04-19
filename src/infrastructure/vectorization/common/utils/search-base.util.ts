import type { SearchBaseItemInput } from 'src/domain/search-base/common/types';

export function buildSearchBaseText(item: SearchBaseItemInput): string {
    const parts = isStructuredSearchBaseContent(item.content)
        ? [item.content]
        : [item.title, item.description, item.content].filter(
              (value): value is string =>
                  typeof value === 'string' && value.trim().length > 0,
          );
    const aliases = parts
        .map((value) => expandLocationAbbreviations(value))
        .filter(
            (value): value is string =>
                typeof value === 'string' &&
                value.trim().length > 0 &&
                !parts.includes(value),
        );

    return [...parts, ...aliases].join('\n\n');
}

function isStructuredSearchBaseContent(value?: string): value is string {
    if (typeof value !== 'string') {
        return false;
    }

    return (
        value.includes('search_phrases:') ||
        value.includes('facts:') ||
        value.includes('topic:')
    );
}

export function normalizeOrderValue(value?: number): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return null;
    }

    const normalized = Math.floor(value);
    return normalized < 1 ? null : normalized;
}

export function resolveSearchBaseOrder(params: {
    item: SearchBaseItemInput;
    index: number;
    storedOrder?: number;
    vectorOrder?: number;
}): number {
    const explicit = normalizeOrderValue(params.item.order);
    if (explicit) {
        return explicit;
    }

    const existing = normalizeOrderValue(
        params.storedOrder ?? params.vectorOrder,
    );
    if (existing) {
        return existing;
    }

    return params.index + 1;
}

export function normalizeMoveAfter(value: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 0;
    }

    const normalized = Math.floor(value);
    return normalized < 0 ? 0 : normalized;
}

export function isOrderChanged(existing?: number, incoming?: number): boolean {
    const normalizedExisting = normalizeOrderValue(existing);
    const normalizedIncoming = normalizeOrderValue(incoming);

    if (normalizedExisting === null && normalizedIncoming === null) {
        return false;
    }

    return normalizedExisting !== normalizedIncoming;
}

export function sortByOrder<T extends { order?: number | null }>(
    items: readonly T[],
): T[] {
    return [...items].sort(
        (left, right) =>
            (left.order ?? Number.MAX_SAFE_INTEGER) -
            (right.order ?? Number.MAX_SAFE_INTEGER),
    );
}

export function normalizeSourceUpdatedAt(value?: string): string {
    if (!value) {
        return new Date().toISOString();
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return new Date().toISOString();
    }

    return parsed.toISOString();
}

export function isOutdatedUpdate(
    existingValue: string | undefined,
    incomingValue: string,
): boolean {
    if (!existingValue) {
        return false;
    }

    const existingDate = new Date(existingValue);
    const incomingDate = new Date(incomingValue);

    if (
        Number.isNaN(existingDate.getTime()) ||
        Number.isNaN(incomingDate.getTime())
    ) {
        return false;
    }

    return existingDate.getTime() > incomingDate.getTime();
}

export function parseDate(value: unknown): Date | null {
    if (value instanceof Date) {
        return value;
    }

    if (typeof value === 'string' || typeof value === 'number') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
}

function expandLocationAbbreviations(text: string): string {
    const expanded = text
        .replace(/(^|[\s(])жк\.?(?=$|[\s,.;:!?)])/giu, '$1жилой комплекс')
        .replace(/(^|[\s(])р-?не(?=$|[\s,.;:!?)])/giu, '$1районе')
        .replace(/(^|[\s(])р-?на(?=$|[\s,.;:!?)])/giu, '$1района')
        .replace(/(^|[\s(])р-?ну(?=$|[\s,.;:!?)])/giu, '$1району')
        .replace(/(^|[\s(])р-?ном(?=$|[\s,.;:!?)])/giu, '$1районом')
        .replace(/(^|[\s(])р-?н\.?(?=$|[\s,.;:!?)])/giu, '$1район')
        .replace(/(^|[\s(])ул\.?(?=$|[\s,.;:!?)])/giu, '$1улица');

    return expanded.trim();
}
