import type { IAgentInput, IAgentOutput } from 'src/shared/agents';
import type { ConversationSummary } from 'src/domain/ai/common/types';

export interface SummarizationInput extends IAgentInput {
    readonly conversationText: string;
    readonly previousSummary?: string;
}

export interface SummarizationOutput extends IAgentOutput {
    readonly summary: ConversationSummary;
}
