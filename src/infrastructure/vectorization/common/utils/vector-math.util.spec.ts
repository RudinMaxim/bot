import {
    averageVectors,
    calculateCosineSimilarity,
    compareVectors,
    findMostSimilar,
    normalizeVector,
    validateVectors,
} from './vector-math.util';
import { VECTOR_COMPARISON_METHOD } from '../constants';

describe('vector-math.util', () => {
    it('calculates cosine similarity for identical vectors', () => {
        const similarity = calculateCosineSimilarity([1, 2, 3], [1, 2, 3]);

        expect(similarity).toBeCloseTo(1, 8);
    });

    it('normalizes vector and preserves zero vectors', () => {
        expect(normalizeVector([3, 4])).toEqual([0.6, 0.8]);
        expect(normalizeVector([0, 0])).toEqual([0, 0]);
    });

    it('returns top-k most similar vectors', () => {
        const result = findMostSimilar(
            [1, 0],
            [
                [1, 0],
                [0.9, 0.1],
                [0, 1],
            ],
            VECTOR_COMPARISON_METHOD.COSINE,
            2,
        );

        expect(result).toHaveLength(2);
        expect(result[0]?.index).toBe(0);
        expect(result[1]?.index).toBe(1);
    });

    it('compares vectors using euclidean mode', () => {
        const comparison = compareVectors(
            [0, 0],
            [3, 4],
            VECTOR_COMPARISON_METHOD.EUCLIDEAN,
        );

        expect(comparison.distance).toBe(5);
        expect(comparison.similarity).toBeCloseTo(1 / 6, 8);
    });

    it('averages vectors', () => {
        expect(
            averageVectors([
                [1, 3, 5],
                [3, 5, 7],
            ]),
        ).toEqual([2, 4, 6]);
    });

    it('validates shape and throws for incompatible vectors', () => {
        expect(() => validateVectors([1], [1, 2])).toThrow(
            'Vectors must have the same length',
        );
    });
});
