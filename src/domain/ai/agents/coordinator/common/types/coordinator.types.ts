import {
    IProcessingMetrics,
    AssignedAgent,
    AgentName,
    AgentPriority,
} from 'src/shared/agents';
import { PipelineMetadata } from '../../../../types';
import { AssistantMode } from 'src/domain/ai/common/types/specialist.types';

export interface CoordinatorResponse {
    success: boolean;
    sessionId: string;
    input: string;
    timestamp: string;
    mode: AssistantMode;
    agents: AssignedAgent[];
    overallConfidence: number;
    metrics: IProcessingMetrics;
    shouldClarify?: boolean;
    clarificationQuestions: string[];
    routingReason?: string;
}

export interface CoordinatorInput {
    sessionId: string;
    input: string;
    timestamp: string;
    metadata?: PipelineMetadata;
}

export interface CoordinatorLLMTask {
    instruction: string;
    parameters?: Record<string, unknown>;
}

export interface CoordinatorLLMAgent {
    agent_name: AgentName;
    priority: AgentPriority;
    tasks: CoordinatorLLMTask[];
}

export interface ParsedCoordinatorLLMResponse {
    mode?: AssistantMode;
    agents: CoordinatorLLMAgent[];
    shouldClarify?: boolean;
    clarificationQuestions?: string[];
    overallConfidence: number;
    routingReason?: string;
}
