export interface SearchBaseAssetItem {
    id: string;
    topic: string;
    intent: string;
    title: string;
    search_phrases: string[];
    facts: string[];
    answer: string;
    restrictions?: string[];
    tags?: string[];
    source: string;
    order: number;
}

export interface SearchBaseAssetPayload {
    dataset: string;
    locale: string;
    version: number;
    items: SearchBaseAssetItem[];
}
