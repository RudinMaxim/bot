import type { SearchBaseUpsertStatus as SearchBaseUpsertStatusValue } from '../constants';

export type SearchBaseUpsertStatus = SearchBaseUpsertStatusValue;

export interface SearchBaseItemInput {
    id?: string;
    title: string;
    description: string;
    content?: string;
    url?: string;
    source?: string;
    updatedAt?: string;
    order?: number;
}

export interface SearchBaseUpsertPayload {
    locale: string;
    source?: string;
    data: SearchBaseItemInput[];
    skipIfUnchanged?: boolean;
}

export interface SearchBaseSearchQuery {
    locale: string;
    query?: string;
    page?: number;
    limit?: number;
    source?: string;
    minSimilarity?: number;
}

export interface SearchBaseSearchItem {
    id: string;
    title: string;
    description: string;
    locale: string;
    source?: string;
    url?: string;
    updatedAt?: string;
    order?: number;
    score?: number;
}

export interface SearchBaseSearchResult {
    items: SearchBaseSearchItem[];
    totalItems: number;
    totalPages: number;
    page: number;
    limit: number;
}

export interface SearchBaseUpsertItemResult {
    id: string;
    status: SearchBaseUpsertStatus;
    reason?: string;
}

export interface SearchBaseUpsertResult {
    locale: string;
    processed: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
    results: SearchBaseUpsertItemResult[];
}

export interface SearchBaseItemDetails {
    id: string;
    title: string;
    description: string;
    locale: string;
    source?: string;
    url?: string;
    updatedAt?: string;
    createdAt?: string;
    contentLength?: number;
    sectionCount?: number;
    order?: number;
}

export interface SearchBaseDeletePayload {
    locale?: string;
    ids?: string[];
    source?: string;
    updatedBefore?: string;
}

export interface SearchBaseDeleteResult {
    deleted: number;
}

export interface SearchBaseRefreshResult {
    triggered: boolean;
}
