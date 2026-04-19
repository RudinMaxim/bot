import { ProcessResult, ProcessingMetrics } from './common.types';
import { ResponseAgentOutput } from '../../agents';

export interface MetricsLogEntry {
    sessionId: string;
    requestText: string;
    responseText: string;
    path: IPathLog;
    metrics: Partial<ProcessingMetrics>;
}

export interface AggregatedStats {
    totalRequests: number;
    fastPathRequests: number;
    slowPathRequests: number;
    errorRequests: number;
    totalExecutionTime: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCachedInputTokens: number;
    totalTokens: number;
    totalLLMCalls: number;
    totalInputCostUsd: number;
    totalOutputCostUsd: number;
    totalCostUsd: number;
    lastReset: number;
}

export interface MetricsInput {
    sessionId: string;
    requestText: string;
    result: ProcessResult<ResponseAgentOutput>;
    startTime: number;
}

export const PATH_LOG = {
    FAST: 'fast',
    SLOW: 'slow',
    ERROR: 'error',
} as const;

export type IPathLog = (typeof PATH_LOG)[keyof typeof PATH_LOG];

export type IScope = 'global' | 'session';
