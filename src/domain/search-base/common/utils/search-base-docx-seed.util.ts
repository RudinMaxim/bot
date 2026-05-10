import type { SearchBaseAssetPayload } from '../types';

export interface SearchBaseDocxQaItem {
    id?: string;
    sectionKey?: string;
    sectionTitle?: string;
    tableIndex?: number;
    rowIndex?: number;
    kind?: 'faq' | 'fact' | string;
    question?: string;
    answer?: string;
}

export interface SearchBaseDocxQaPayload {
    extractedAt?: string;
    items?: SearchBaseDocxQaItem[];
}

export interface SearchBaseSeedItem {
    id: string;
    title: string;
    description: string;
    content: string;
    embeddingText?: string;
    source: string;
    order: number;
    updatedAt?: string;
}

export interface SearchBaseSeedPayload {
    locale: string;
    source: string;
    data: SearchBaseSeedItem[];
}

export interface BuildSearchBaseSeedFromDocxOptions {
    locale?: string;
    source?: string;
    maxDescriptionLength?: number;
}

const DEFAULT_LOCALE = 'ru';
const DEFAULT_SOURCE = 'mys-docx';
const DEFAULT_MAX_DESCRIPTION_LENGTH = 5000;

export function buildSearchBaseSeedFromDocxExtract(
    payload: SearchBaseDocxQaPayload,
    options: BuildSearchBaseSeedFromDocxOptions = {},
): SearchBaseSeedPayload {
    const locale = options.locale?.trim() || DEFAULT_LOCALE;
    const source = options.source?.trim() || DEFAULT_SOURCE;
    const maxDescriptionLength = Math.max(
        1,
        Math.floor(
            options.maxDescriptionLength ?? DEFAULT_MAX_DESCRIPTION_LENGTH,
        ),
    );
    const updatedAt = normalizeOptionalIsoDate(payload.extractedAt);

    const data = (payload.items ?? [])
        .map((item, index) => buildSeedItemFromDocxQa(item, index, source, {
            maxDescriptionLength,
            updatedAt,
        }))
        .filter((item): item is SearchBaseSeedItem => item !== null);

    return {
        locale,
        source,
        data,
    };
}

export function buildSearchBaseSeedFromAsset(
    payload: SearchBaseAssetPayload,
): SearchBaseSeedPayload {
    const locale = normalizeText(payload.locale) || DEFAULT_LOCALE;

    return {
        locale,
        source: 'resource-asset',
        data: payload.items
            .map((item) => buildSeedItemFromAsset(item))
            .filter((item): item is SearchBaseSeedItem => item !== null),
    };
}

function buildSeedItemFromDocxQa(
    item: SearchBaseDocxQaItem,
    index: number,
    source: string,
    options: {
        maxDescriptionLength: number;
        updatedAt?: string;
    },
): SearchBaseSeedItem | null {
    const question = normalizeText(item.question);
    const answer = normalizeText(item.answer);
    if (!question || !answer) {
        return null;
    }

    const id = normalizeText(item.id) || buildFallbackId(item, index);

    return {
        id,
        title: question,
        description: buildDescription(answer, options.maxDescriptionLength),
        content: answer,
        source,
        order: index + 1,
        updatedAt: options.updatedAt,
    };
}

function buildSeedItemFromAsset(
    item: SearchBaseAssetPayload['items'][number],
): SearchBaseSeedItem | null {
    const id = normalizeText(item.id);
    const title = normalizeText(item.title);
    const answer = normalizeText(item.answer);
    const source = normalizeText(item.source);
    const order = normalizeOrder(item.order);

    if (!id || !title || !answer || !source || order === undefined) {
        return null;
    }

    return {
        id,
        title,
        description: answer,
        content: buildSearchBaseAssetFullContent(item),
        embeddingText: buildSearchBaseAssetEmbeddingText(item),
        source,
        order,
    };
}

function buildSearchBaseAssetEmbeddingText(
    item: SearchBaseAssetPayload['items'][number],
): string {
    const queries = normalizeTextList(item.queries);

    return [
        `title: ${normalizeText(item.title) || ''}`,
        `queries: ${queries.join(' | ')}`,
        `answer: ${normalizeText(item.answer) || ''}`,
    ].join('\n');
}

function buildSearchBaseAssetFullContent(
    item: SearchBaseAssetPayload['items'][number],
): string {
    const queries = normalizeTextList(item.queries);
    const guardrails = normalizeTextList(item.guardrails);

    return [
        `category: ${normalizeText(item.category) || ''}`,
        `title: ${normalizeText(item.title) || ''}`,
        `queries: ${queries.join(' | ')}`,
        `answer: ${normalizeText(item.answer) || ''}`,
        guardrails.length > 0
            ? `guardrails: ${guardrails.join(' | ')}`
            : undefined,
    ]
        .filter((value): value is string => typeof value === 'string')
        .join('\n');
}

function buildFallbackId(item: SearchBaseDocxQaItem, index: number): string {
    const sectionKey = normalizeText(item.sectionKey) || 'docx';
    if (
        typeof item.rowIndex === 'number' &&
        Number.isFinite(item.rowIndex) &&
        item.rowIndex >= 1
    ) {
        return `${sectionKey}-${String(Math.floor(item.rowIndex)).padStart(3, '0')}`;
    }

    return `${sectionKey}-${String(index + 1).padStart(3, '0')}`;
}

function buildDescription(answer: string, maxLength: number): string {
    if (answer.length <= maxLength) {
        return answer;
    }

    return answer.slice(0, maxLength).trimEnd();
}

function normalizeText(value: unknown): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }

    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized.length > 0 ? normalized : undefined;
}

function normalizeOptionalIsoDate(value: unknown): string | undefined {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return undefined;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return undefined;
    }

    return parsed.toISOString();
}

function normalizeOrder(value: unknown): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return undefined;
    }

    const normalized = Math.floor(value);
    return normalized >= 1 ? normalized : undefined;
}

function normalizeTextList(values: unknown): string[] {
    if (!Array.isArray(values)) {
        return [];
    }

    return values
        .map((value) => normalizeText(value))
        .filter((value): value is string => Boolean(value));
}
