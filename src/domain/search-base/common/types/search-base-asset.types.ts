export interface SearchBaseAssetStep {
    id: string;
    displayName: string;
    targetId: string;
}

export interface SearchBaseAssetItem {
    id: string;
    category: string;
    title: string;
    queries: string[];
    answer: string;
    guardrails?: string[];
    source: string;
    order: number;
    followUpStepIds?: string[];
}

export interface SearchBaseAssetPayload {
    dataset: string;
    locale: string;
    version: number;
    steps: SearchBaseAssetStep[];
    items: SearchBaseAssetItem[];
}
