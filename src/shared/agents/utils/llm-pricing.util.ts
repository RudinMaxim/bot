interface LlmModelPricing {
    inputPer1MUsd: number;
    cachedInputPer1MUsd?: number;
    outputPer1MUsd: number;
}

export interface LlmCostCalculationInput {
    modelName?: string;
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens?: number;
}

export interface LlmCostCalculationResult {
    pricingModel: string;
    inputCostUsd: number;
    outputCostUsd: number;
    totalCostUsd: number;
    cachedInputTokens: number;
}

export interface LlmResponseMetrics {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cachedInputTokens: number;
    inputCostUsd: number;
    outputCostUsd: number;
    totalCostUsd: number;
    pricingModel?: string;
}

const LLM_MODEL_PRICING: Record<string, LlmModelPricing> = {
    // GPT-5.4 family (openai.com/api/pricing, March 2026)
    'gpt-5.4': {
        inputPer1MUsd: 2.5,
        cachedInputPer1MUsd: 0.25,
        outputPer1MUsd: 15,
    },
    'gpt-5.4-mini': {
        inputPer1MUsd: 0.75,
        cachedInputPer1MUsd: 0.075,
        outputPer1MUsd: 4.5,
    },
    'gpt-5.4-nano': {
        inputPer1MUsd: 0.2,
        cachedInputPer1MUsd: 0.02,
        outputPer1MUsd: 1.25,
    },
    // GPT-4.1 family
    'gpt-4.1': {
        inputPer1MUsd: 2,
        cachedInputPer1MUsd: 0.5,
        outputPer1MUsd: 8,
    },
    'gpt-4.1-mini': {
        inputPer1MUsd: 0.4,
        cachedInputPer1MUsd: 0.1,
        outputPer1MUsd: 1.6,
    },
    'gpt-4.1-nano': {
        inputPer1MUsd: 0.1,
        cachedInputPer1MUsd: 0.025,
        outputPer1MUsd: 0.4,
    },
    // GPT-4o family
    'gpt-4o': {
        inputPer1MUsd: 2.5,
        cachedInputPer1MUsd: 1.25,
        outputPer1MUsd: 10,
    },
    'gpt-4o-mini': {
        inputPer1MUsd: 0.15,
        cachedInputPer1MUsd: 0.075,
        outputPer1MUsd: 0.6,
    },
};

const SORTED_MODEL_KEYS = Object.keys(LLM_MODEL_PRICING).sort(
    (left, right) => right.length - left.length,
);

function normalizeModelName(modelName?: string): string | null {
    if (!modelName) return null;
    const normalized = modelName.trim().toLowerCase();
    if (normalized.length === 0) return null;

    const providerAgnostic = normalized.includes('/')
        ? (normalized.split('/').pop() ?? normalized)
        : normalized;

    return providerAgnostic.length > 0 ? providerAgnostic : null;
}

function roundUsd(value: number): number {
    return Math.round(value * 1e8) / 1e8;
}

function extractUsageMetadata(response: unknown): {
    input_tokens?: number;
    output_tokens?: number;
    input_token_details?: { cache_read?: number };
} | null {
    if (!response || typeof response !== 'object') {
        return null;
    }

    const usageMetadata = (response as Record<string, unknown>).usage_metadata;
    if (!usageMetadata || typeof usageMetadata !== 'object') {
        return null;
    }

    return usageMetadata as {
        input_tokens?: number;
        output_tokens?: number;
        input_token_details?: { cache_read?: number };
    };
}

function extractResponseModelName(response: unknown): string | undefined {
    if (!response || typeof response !== 'object') {
        return undefined;
    }

    const responseMetadata = (response as Record<string, unknown>)
        .response_metadata;
    if (!responseMetadata || typeof responseMetadata !== 'object') {
        return undefined;
    }

    const metadata = responseMetadata as Record<string, unknown>;
    if (typeof metadata.model_name === 'string') {
        return metadata.model_name;
    }

    return typeof metadata.model === 'string' ? metadata.model : undefined;
}

export function resolveLlmPricingModel(modelName?: string): string | null {
    const normalized = normalizeModelName(modelName);
    if (!normalized) return null;

    if (LLM_MODEL_PRICING[normalized]) {
        return normalized;
    }

    const matchedPrefix = SORTED_MODEL_KEYS.find(
        (key) => normalized === key || normalized.startsWith(`${key}-`),
    );
    return matchedPrefix ?? null;
}

export function calculateLlmTokenCost(
    input: LlmCostCalculationInput,
): LlmCostCalculationResult | null {
    const pricingModel = resolveLlmPricingModel(input.modelName);
    if (!pricingModel) {
        return null;
    }

    const pricing = LLM_MODEL_PRICING[pricingModel];
    const inputTokens = Math.max(0, input.inputTokens);
    const outputTokens = Math.max(0, input.outputTokens);
    const cachedInputTokens = Math.min(
        inputTokens,
        Math.max(0, input.cachedInputTokens ?? 0),
    );
    const uncachedInputTokens = Math.max(inputTokens - cachedInputTokens, 0);

    const uncachedInputCost =
        (uncachedInputTokens / 1_000_000) * pricing.inputPer1MUsd;
    const cachedInputCost =
        pricing.cachedInputPer1MUsd === undefined
            ? (cachedInputTokens / 1_000_000) * pricing.inputPer1MUsd
            : (cachedInputTokens / 1_000_000) * pricing.cachedInputPer1MUsd;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1MUsd;

    const inputCostUsd = roundUsd(uncachedInputCost + cachedInputCost);
    const outputCostUsd = roundUsd(outputCost);

    return {
        pricingModel,
        inputCostUsd,
        outputCostUsd,
        totalCostUsd: roundUsd(inputCostUsd + outputCostUsd),
        cachedInputTokens,
    };
}

export function buildLlmResponseMetrics(params: {
    response: unknown;
    fallbackInputTokens: number;
    fallbackOutputTokens: number;
    defaultModelName?: string;
}): LlmResponseMetrics {
    const usageMetadata = extractUsageMetadata(params.response);
    const modelName =
        extractResponseModelName(params.response) ?? params.defaultModelName;
    const inputTokens = Math.max(
        0,
        usageMetadata?.input_tokens ?? params.fallbackInputTokens,
    );
    const outputTokens = Math.max(
        0,
        usageMetadata?.output_tokens ?? params.fallbackOutputTokens,
    );
    const cachedInputTokens = Math.max(
        0,
        usageMetadata?.input_token_details?.cache_read ?? 0,
    );
    const pricing = calculateLlmTokenCost({
        modelName,
        inputTokens,
        outputTokens,
        cachedInputTokens,
    });

    return {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        cachedInputTokens: pricing?.cachedInputTokens ?? cachedInputTokens,
        inputCostUsd: pricing?.inputCostUsd ?? 0,
        outputCostUsd: pricing?.outputCostUsd ?? 0,
        totalCostUsd: pricing?.totalCostUsd ?? 0,
        pricingModel: pricing?.pricingModel,
    };
}
