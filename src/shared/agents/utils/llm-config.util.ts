import type { ILLMAgentConfig } from '../types';

type LlmProviderConfig = {
    apiKey?: string;
    baseUrl?: string;
};

type LlmModelConfig = Omit<ILLMAgentConfig['llm'], 'apiKey' | 'baseUrl'>;

export function buildLlmAgentConfig(
    provider: LlmProviderConfig,
    config: LlmModelConfig,
): ILLMAgentConfig['llm'] {
    const apiKey = provider.apiKey?.trim();
    if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY not found');
    }

    return {
        apiKey,
        baseUrl: provider.baseUrl?.trim() || undefined,
        ...config,
    };
}

export type AgentModelSelectionPolicy =
    | 'primary'
    | 'fast'
    | 'balanced'
    | 'quality';

export function selectAgentModel(
    models: readonly string[],
    policy: AgentModelSelectionPolicy = 'primary',
): string {
    const normalized = models
        .map((model) => model.trim())
        .filter((model) => model.length > 0);

    if (!normalized.length) {
        throw new Error('At least one model must be configured');
    }

    if (policy === 'primary' || policy === 'fast') {
        return normalized[0];
    }

    if (policy === 'quality') {
        return normalized[normalized.length - 1];
    }

    const middleIndex = Math.floor((normalized.length - 1) / 2);
    return normalized[middleIndex];
}
