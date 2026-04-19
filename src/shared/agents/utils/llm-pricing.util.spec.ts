import {
    buildLlmResponseMetrics,
    calculateLlmTokenCost,
    resolveLlmPricingModel,
} from './llm-pricing.util';

describe('llm-pricing.util', () => {
    it('resolves dated model aliases to the configured pricing model', () => {
        expect(resolveLlmPricingModel('gpt-5.4-2026-03-01')).toBe(
            'gpt-5.4',
        );
        expect(resolveLlmPricingModel('openai/gpt-5.4-mini')).toBe(
            'gpt-5.4-mini',
        );
    });

    it('calculates input, cached input, and output cost separately', () => {
        const result = calculateLlmTokenCost({
            modelName: 'gpt-5.4',
            inputTokens: 2_000_000,
            outputTokens: 500_000,
            cachedInputTokens: 500_000,
        });

        expect(result).toEqual({
            pricingModel: 'gpt-5.4',
            cachedInputTokens: 500_000,
            inputCostUsd: 3.875,
            outputCostUsd: 7.5,
            totalCostUsd: 11.375,
        });
    });

    it('builds metrics from LLM response usage when present', () => {
        const result = buildLlmResponseMetrics({
            response: {
                usage_metadata: {
                    input_tokens: 1200,
                    output_tokens: 300,
                    input_token_details: { cache_read: 200 },
                },
                response_metadata: {
                    model_name: 'openai/gpt-5.4-2026-03-01',
                },
            },
            fallbackInputTokens: 1,
            fallbackOutputTokens: 1,
            defaultModelName: 'gpt-5.4',
        });

        expect(result).toEqual({
            inputTokens: 1200,
            outputTokens: 300,
            totalTokens: 1500,
            cachedInputTokens: 200,
            inputCostUsd: 0.00255,
            outputCostUsd: 0.0045,
            totalCostUsd: 0.00705,
            pricingModel: 'gpt-5.4',
        });
    });
});
