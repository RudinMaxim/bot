import type { VectorComparisonMethod as VectorComparisonMethodValue } from '../constants';

export type VectorComparisonMethod = VectorComparisonMethodValue;

export interface EmbeddingConfig {
    ollama: {
        url: string;
        model: string;
        timeout: number;
        maxRetries: number;
    };
}

export interface EmbeddingResponse {
    embedding: number[];
    model: string;
    prompt_eval_count?: number;
    eval_count?: number;
}

export interface VectorComparisonResult {
    similarity: number;
    distance: number;
    method: VectorComparisonMethod;
}

export interface BatchEmbeddingRequest {
    texts: string[];
    normalize?: boolean;
}

export interface BatchEmbeddingResponse {
    embeddings: number[][];
    metadata: {
        totalTexts: number;
        averageDimensions: number;
        processingTime: number;
        model: string;
    };
}

export interface ProcessedEmbeddingResult {
    textData: ProcessedTextResult;
    embedding: number[];
    embeddingMetadata: {
        dimensions: number;
        generationTime: number;
    };
}

export interface TextProcessingConfig {
    normalizeWhitespace: boolean;
    removeUrls: boolean;
    removeEmails: boolean;
    cleanExcessivePunctuation: boolean;
    removeEmojis: boolean;
    removeControlChars: boolean;
    removeOnlyMostFrequent: boolean;
    minTextLength: number;
    maxTextLength: number;
    autoDetectSections: boolean;
    minSectionLength: number;
}

export interface ProcessedTextResult {
    text: string;
    sectionIndex: number;
    totalSections: number;
    length: number;
    hasMultipleSections: boolean;
    sectionSeparator: string | null;
    processing: {
        compressionRatio: number;
        stepsApplied: number;
        wordsPreserved: number;
        wordsRemoved: number;
        success: boolean;
    };
}
