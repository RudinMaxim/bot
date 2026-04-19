import type { AgentPriority, IAgentOutput } from 'src/shared/agents';
import type { AiProcessingMetadata } from 'src/shared/types/interaction.types';
import type { PipelineMetadata } from '../../../../types';
import type { SearchAnswerability, SearchResult } from '../../../search';
import type { QuickReplyIntent as QuickReplyIntentValue } from '../constants/response.const';
import type {
    AssistantMode,
    SpecialistInfo,
} from '../../../../common/types/specialist.types';

export type AggregationStatus = 'completed' | 'partial' | 'failed';
export type QuickReplyIntent = QuickReplyIntentValue;

export interface QuickReply {
    readonly text: string;
    readonly intent: QuickReplyIntent;
    readonly priority: number;
    readonly payload?: Record<string, unknown>;
}

export interface QuickReplyCandidate {
    readonly text: string;
    readonly intent: QuickReplyIntent;
    readonly priority?: number;
    readonly payload?: Record<string, unknown>;
}

export type ChatFormFieldType =
    | 'text'
    | 'phone'
    | 'email'
    | 'phone_or_email'
    | 'date';

export interface ChatFormField {
    readonly key: string;
    readonly label: string;
    readonly type: ChatFormFieldType;
    readonly required?: boolean;
    readonly placeholder?: string;
    readonly value?: string;
}

export interface ChatForm {
    readonly id: string;
    readonly title: string;
    readonly description?: string;
    readonly submitText?: string;
    readonly fields: ReadonlyArray<ChatFormField>;
}

export type PropertyCard = {
    readonly id?: string | number;
    readonly [key: string]: unknown;
};

export type AnalyticsAgentResponse = {
    readonly propertyCards?: ReadonlyArray<PropertyCard>;
    readonly [key: string]: unknown;
};

export interface ResponseStreamingOptions {
    readonly onTextChunk?: (chunk: string, text: string) => void;
}

export interface ResponseAgentInput {
    readonly sessionId: string;
    readonly originalQuery: string;
    readonly mode?: AssistantMode;
    readonly searchResults?: SearchResult[];
    readonly analysisResults?: AnalyticsAgentResponse[];
    readonly clarificationQuestions?: readonly string[];
    readonly specialist?: SpecialistInfo;
    readonly sourceType?: string;
    readonly confidenceScore?: number;
    readonly status?: AggregationStatus;
    readonly timestamp: string;
    readonly metadata?: PipelineMetadata;
    readonly streaming?: ResponseStreamingOptions;
}

export interface GoalAchievement {
    readonly achieved: boolean;
    readonly partial: boolean;
    readonly missingData: readonly string[];
}

export type ResponseVisualType =
    | 'stats'
    | 'checklist'
    | 'comparison'
    | 'table'
    | 'property_cards'
    | 'form';

export interface ResponseVisualBlockBase {
    readonly type: ResponseVisualType;
    readonly title?: string;
    readonly description?: string;
}

export interface ResponseStatsItem {
    readonly label: string;
    readonly value: string;
    readonly accent?: boolean;
}

export interface ResponseStatsBlock extends ResponseVisualBlockBase {
    readonly type: 'stats';
    readonly items: ReadonlyArray<ResponseStatsItem>;
}

export interface ResponseChecklistItem {
    readonly text: string;
    readonly checked?: boolean;
}

export interface ResponseChecklistBlock extends ResponseVisualBlockBase {
    readonly type: 'checklist';
    readonly items: ReadonlyArray<ResponseChecklistItem>;
}

export interface ResponseComparisonRow {
    readonly label: string;
    readonly values: ReadonlyArray<string>;
}

export interface ResponseComparisonBlock extends ResponseVisualBlockBase {
    readonly type: 'comparison';
    readonly columns: ReadonlyArray<string>;
    readonly rows: ReadonlyArray<ResponseComparisonRow>;
}

export interface ResponseTableBlock extends ResponseVisualBlockBase {
    readonly type: 'table';
    readonly columns: ReadonlyArray<string>;
    readonly rows: ReadonlyArray<ReadonlyArray<string>>;
}

export interface ResponsePropertyCardsBlock extends ResponseVisualBlockBase {
    readonly type: 'property_cards';
    readonly items: ReadonlyArray<PropertyCard>;
}

export interface ResponseFormBlock extends ResponseVisualBlockBase {
    readonly type: 'form';
    readonly form: ChatForm;
}

export type ResponseVisualBlock =
    | ResponseStatsBlock
    | ResponseChecklistBlock
    | ResponseComparisonBlock
    | ResponseTableBlock
    | ResponsePropertyCardsBlock
    | ResponseFormBlock;

export interface ResponseMetadata extends AiProcessingMetadata {
    readonly executionTime: number;
    readonly agentsProcessed: number;
    readonly agentsFailed?: number;
    readonly searchResultsCount: number;
    readonly answerability?: SearchAnswerability;
    readonly analysisResultsCount: number;
    readonly hasUrl: boolean;
    readonly coordinatorConfidence: number;
    readonly actionsExecuted?: number;
    readonly quickRepliesCount?: number;
    readonly quickReplies?: QuickReply[];
}

export interface ResponseAgentOutput extends IAgentOutput {
    readonly mode: AssistantMode;
    readonly response: string;
    readonly confidence: AgentPriority;
    readonly goalAchievement?: GoalAchievement;
    readonly metadata: ResponseMetadata;
    readonly clarificationQuestions?: readonly string[];
    readonly specialist?: SpecialistInfo;
    readonly quickReplies?: QuickReply[];
    readonly propertyCards?: PropertyCard[];
    readonly form?: ChatForm;
}

export interface AggregatedResults {
    readonly searchResults: SearchResult[];
    readonly analysisResults: AnalyticsAgentResponse[];
    readonly sourceTypes: readonly string[];
    readonly confidenceScores: readonly number[];
    readonly questions: Set<string>;
    readonly status: AggregationStatus;
    readonly meta: {
        readonly agentsProcessed: number;
        readonly searchResultsCount: number;
        readonly hasAnalysis: boolean;
        readonly urlIncluded: boolean;
        readonly answerability?: SearchAnswerability;
        readonly answerableSearchResults?: number;
        readonly insufficientSearchResults?: number;
        readonly unavailableSearchResults?: number;
    };
}

export interface ResponseFormat {
    readonly response: string;
    readonly confidence: AgentPriority;
    readonly goalAchievement?: GoalAchievement;
    readonly quickReplies?: Array<{
        readonly text: string;
        readonly intent: QuickReplyIntent;
        readonly priority?: number;
        readonly payload?: Record<string, unknown>;
    }>;
}

export interface LLMResponsePayload {
    readonly response: string;
    readonly confidence: string;
    readonly goalAchievement?: GoalAchievement;
    readonly quickReplies?: QuickReply[];
}
