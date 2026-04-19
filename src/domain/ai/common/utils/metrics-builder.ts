import { toFiniteNumber } from './ai.utils';
import type { ProcessingMetrics, PipelineMetadata } from '../types';
import type { ResponseAgentOutput } from '../../agents';
import { AGENT_PRIORITY } from '../constants';

export interface MetricsBuildParams {
    /** Response agent output (may be undefined for error cases). */
    data?: ResponseAgentOutput;
    /** Request start timestamp (Date.now()). */
    startTime: number;
    /** Fallback pipeline metadata when data.metadata is missing. */
    metadata?: PipelineMetadata;
    /** Override for agentsFailed count (from orchestrator). */
    failedAgentsOverride?: number;
    /** Whether this is an error result (affects agentsFailed fallback). */
    isError?: boolean;
    /** Pre-computed metrics from ProcessResult (metrics.service path). */
    resultMetrics?: ProcessingMetrics;
}

/**
 * Build ProcessingMetrics from agent output and/or pipeline metadata.
 *
 * Consolidates three previously duplicated implementations:
 * - orchestrator.service.ts buildProcessingMetrics()
 * - ai.service.ts buildProcessingMetrics()
 * - metrics.service.ts extractMetrics()
 */
export function buildProcessingMetrics(
    params: MetricsBuildParams,
): ProcessingMetrics {
    const { data, startTime, metadata, failedAgentsOverride, isError } = params;
    const resultMetrics = params.resultMetrics;

    // Prefer resultMetrics (from ProcessResult.metrics), then data.metrics
    const agentMetrics: Partial<ProcessingMetrics> | undefined =
        resultMetrics ?? data?.metrics;
    // Prefer data.metadata, fallback to external metadata
    const meta = data?.metadata ?? metadata;

    const executionTime =
        toFiniteNumber(agentMetrics?.executionTime) ||
        Math.max(Date.now() - startTime, 0);

    const inputTokens = toFiniteNumber(agentMetrics?.inputTokens);
    const outputTokens = toFiniteNumber(agentMetrics?.outputTokens);
    const totalTokens = agentMetrics?.totalTokens ?? inputTokens + outputTokens;
    const cachedInputTokens = toFiniteNumber(agentMetrics?.cachedInputTokens);
    const inputCostUsd = toFiniteNumber(agentMetrics?.inputCostUsd);
    const outputCostUsd = toFiniteNumber(agentMetrics?.outputCostUsd);
    const totalCostUsd =
        agentMetrics?.totalCostUsd ?? inputCostUsd + outputCostUsd;

    // agentsFailed: prefer explicit override, then from metrics/meta, then infer from error state
    const agentsFailed =
        failedAgentsOverride ??
        (toFiniteNumber(agentMetrics?.agentsFailed) ||
            toFiniteNumber(
                (meta as Record<string, unknown> | undefined)?.agentsFailed,
            ) ||
            (isError || data?.success === false ? 1 : 0));

    return {
        executionTime,
        inputTokens,
        outputTokens,
        totalTokens,
        cachedInputTokens,
        inputCostUsd,
        outputCostUsd,
        totalCostUsd,
        retryCount: toFiniteNumber(agentMetrics?.retryCount),
        searchAgentUsed:
            typeof agentMetrics?.searchAgentUsed === 'boolean'
                ? agentMetrics.searchAgentUsed
                : undefined,
        searchDocumentsCount: toFiniteNumber(
            agentMetrics?.searchDocumentsCount,
        ),
        fallbackUsed:
            typeof agentMetrics?.fallbackUsed === 'boolean'
                ? agentMetrics.fallbackUsed
                : undefined,
        fallbackReasons: agentMetrics?.fallbackReasons ?? [],
        pricingModels: agentMetrics?.pricingModels ?? [],
        modelBreakdown: agentMetrics?.modelBreakdown ?? [],
        coordinatorTime:
            toFiniteNumber(agentMetrics?.coordinatorTime) ||
            toFiniteNumber(meta?.coordinatorTime),
        searchTime:
            toFiniteNumber(agentMetrics?.searchTime) ||
            toFiniteNumber(meta?.searchTime),
        analyticsTime:
            toFiniteNumber(agentMetrics?.analyticsTime) ||
            toFiniteNumber(meta?.analyticsTime),
        actionTime:
            toFiniteNumber(agentMetrics?.actionTime) ||
            toFiniteNumber(meta?.actionTime),
        responseTime: toFiniteNumber(
            agentMetrics?.responseTime ??
                meta?.responseTime ??
                (meta as Record<string, unknown> | undefined)?.executionTime ??
                agentMetrics?.executionTime ??
                executionTime,
        ),
        agentsInvoked:
            toFiniteNumber(agentMetrics?.agentsInvoked) ||
            toFiniteNumber(meta?.agentsProcessed),
        agentsFailed,
        searchResultsCount:
            toFiniteNumber(agentMetrics?.searchResultsCount) ||
            toFiniteNumber(meta?.searchResultsCount),
        analysisResultsCount:
            toFiniteNumber(agentMetrics?.analysisResultsCount) ||
            toFiniteNumber(meta?.analysisResultsCount),
        actionsExecuted:
            toFiniteNumber(agentMetrics?.actionsExecuted) ||
            toFiniteNumber(meta?.actionsExecuted),
        coordinatorConfidence:
            toFiniteNumber(agentMetrics?.coordinatorConfidence) ||
            toFiniteNumber(meta?.coordinatorConfidence),
        finalConfidence:
            agentMetrics?.finalConfidence ??
            data?.confidence ??
            AGENT_PRIORITY.LOW,
        fastPathUsed:
            typeof agentMetrics?.fastPathUsed === 'boolean'
                ? agentMetrics.fastPathUsed
                : Boolean(meta?.fastPath),
        clarificationRequired:
            typeof agentMetrics?.clarificationRequired === 'boolean'
                ? agentMetrics.clarificationRequired
                : Boolean(meta?.shouldClarify),
        llmCalls:
            toFiniteNumber(agentMetrics?.llmCalls) ||
            toFiniteNumber(meta?.llmCalls ?? meta?.agentsProcessed),
        apiCalls:
            toFiniteNumber(agentMetrics?.apiCalls) ||
            toFiniteNumber(meta?.apiCalls),
        dbQueries:
            toFiniteNumber(agentMetrics?.dbQueries) ||
            toFiniteNumber(meta?.dbQueries),
    };
}
