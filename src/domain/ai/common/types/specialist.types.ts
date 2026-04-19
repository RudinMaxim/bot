export type AssistantMode =
    | 'answer'
    | 'clarify'
    | 'partial_with_specialist'
    | 'route_to_specialist';

export interface SpecialistRecord {
    id: string;
    fullName: string;
    position: string;
    contact: string;
    topics: string[];
    isDefault?: boolean;
}

export interface SpecialistCatalogAsset {
    specialists: SpecialistRecord[];
}

export interface SpecialistInfo {
    fullName: string;
    position: string;
    contact: string;
    reason: string;
}
