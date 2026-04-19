import type { VectorComparisonResult } from '../types';
import {
    VECTOR_COMPARISON_METHOD,
    type VectorComparisonMethod,
} from '../constants';

export function validateVectors(vector1: number[], vector2: number[]): void {
    if (!Array.isArray(vector1) || !Array.isArray(vector2)) {
        throw new Error('Both arguments must be arrays');
    }

    if (vector1.length !== vector2.length) {
        throw new Error('Vectors must have the same length');
    }

    if (vector1.length === 0) {
        throw new Error('Vectors cannot be empty');
    }
}

export function dotProduct(vector1: number[], vector2: number[]): number {
    let sum = 0;
    for (let index = 0; index < vector1.length; index += 1) {
        sum += vector1[index] * vector2[index];
    }

    return sum;
}

export function magnitude(vector: number[]): number {
    let sum = 0;
    for (const value of vector) {
        sum += value * value;
    }

    return Math.sqrt(sum);
}

export function calculateCosineSimilarity(
    vector1: number[],
    vector2: number[],
): number {
    validateVectors(vector1, vector2);

    const dot = dotProduct(vector1, vector2);
    const magnitude1 = magnitude(vector1);
    const magnitude2 = magnitude(vector2);

    if (magnitude1 === 0 || magnitude2 === 0) {
        return 0;
    }

    return dot / (magnitude1 * magnitude2);
}

export function calculateEuclideanDistance(
    vector1: number[],
    vector2: number[],
): number {
    validateVectors(vector1, vector2);

    let sum = 0;
    for (let index = 0; index < vector1.length; index += 1) {
        const diff = vector1[index] - vector2[index];
        sum += diff * diff;
    }

    return Math.sqrt(sum);
}

export function compareVectors(
    vector1: number[],
    vector2: number[],
    method: VectorComparisonMethod = VECTOR_COMPARISON_METHOD.COSINE,
): VectorComparisonResult {
    validateVectors(vector1, vector2);

    switch (method) {
        case 'cosine': {
            const similarity = calculateCosineSimilarity(vector1, vector2);
            return {
                method,
                similarity,
                distance: 1 - similarity,
            };
        }
        case 'euclidean': {
            const distance = calculateEuclideanDistance(vector1, vector2);
            return {
                method,
                distance,
                similarity: 1 / (1 + distance),
            };
        }
        case 'dot': {
            const similarity = dotProduct(vector1, vector2);
            return {
                method,
                similarity,
                distance: -similarity,
            };
        }
        default:
            throw new Error(`Unsupported comparison method: ${String(method)}`);
    }
}

export function findMostSimilar(
    queryVector: number[],
    candidateVectors: number[][],
    method: VectorComparisonMethod = VECTOR_COMPARISON_METHOD.COSINE,
    topK = 5,
): Array<{ index: number; similarity: number; distance: number }> {
    if (!candidateVectors.length) {
        return [];
    }

    const results = candidateVectors.map((vector, index) => {
        const comparison = compareVectors(queryVector, vector, method);
        return {
            index,
            similarity: comparison.similarity,
            distance: comparison.distance,
        };
    });

    results.sort((left, right) => right.similarity - left.similarity);
    return results.slice(0, Math.min(topK, results.length));
}

export function normalizeVector(vector: number[]): number[] {
    const vectorMagnitude = magnitude(vector);
    if (vectorMagnitude === 0) {
        return vector.slice();
    }

    return vector.map((value) => value / vectorMagnitude);
}

export function averageVectors(vectors: number[][]): number[] {
    const length = vectors[0]?.length ?? 0;
    const sum = new Array<number>(length).fill(0);

    for (const vector of vectors) {
        for (let index = 0; index < length; index += 1) {
            sum[index] += vector[index];
        }
    }

    return sum.map((value) => value / vectors.length);
}
