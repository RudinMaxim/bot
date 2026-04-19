import { PipelineMetadata } from 'src/domain/ai/common/types';
import {
    IAgentInput,
    IAgentOutput,
    IAgentConfig,
    AssignedAgent,
} from 'src/shared/agents';

export interface SearchAgentConfig extends IAgentConfig {
    readonly search: {
        readonly defaultLimit: number;
        readonly maxLimit: number;
        readonly minSimilarity: number;
        readonly hybridAlpha: number;
    };
}

export interface SearchAgentInput extends IAgentInput {
    readonly agents: ReadonlyArray<AssignedAgent>;
    readonly metadata?: PipelineMetadata;
}

export interface SearchAgentResponse extends IAgentOutput {
    readonly searchResults: ReadonlyArray<SearchResult>;
}

export type SearchAnswerability =
    | 'answerable'
    | 'insufficient_evidence'
    | 'unavailable';

export type SearchCoverage = 'full' | 'partial' | 'none';

export interface SearchResultMetadata {
    readonly totalResults: number;
    readonly similarity: number;
    readonly executionTime: number;
    readonly strategy?: 'vector' | 'hybrid';
    readonly answerability?: SearchAnswerability;
    readonly coverage?: SearchCoverage;
    readonly rawResults?: number;
    readonly topSimilarity?: number;
}

export interface SearchResult {
    readonly taskId: string;
    readonly query: string;
    readonly summarizedResponse?: string;
    readonly results: ReadonlyArray<WeaviateDocument>;
    readonly metadata: SearchResultMetadata;
    readonly error?: string;
}

export interface VectorSearchParams {
    readonly query: string;
    readonly keywordQuery: string;
    readonly limit: number;
    readonly similarity: number;
    readonly strategy: 'vector' | 'hybrid';
    readonly hybridAlpha?: number;
    readonly queryProperties?: string[];
    readonly filters?: Readonly<Record<string, unknown>>;
}

export interface WeaviateAdditional {
    readonly id: string;
    readonly certainty: number;
    readonly distance: number;
}

export interface WeaviateMetadata {
    readonly source?: string;
    readonly blobType?: string;
    readonly certainty?: number;
    readonly distance?: number;
    readonly fallback?: boolean;
    readonly [key: string]: unknown;
}

export interface WeaviateDocument {
    readonly _additional: WeaviateAdditional;
    readonly title?: string;
    readonly content?: string;
    readonly url?: string;
    readonly metadata: WeaviateMetadata | null;
}
