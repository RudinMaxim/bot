import { PipelineMetadata } from './common.types';

export type Role = 'user' | 'assistant' | 'system';

export interface MessageHistory {
    id: string;
    timestamp: string;
    role: Role;
    content: string;
    tokens: number;
    /** true когда сообщение уже вошло в summary и может быть вытеснено из verbatim-окна */
    summarized?: boolean;
    metadata?: PipelineMetadata;
}

export interface SessionContactContext {
    clientName?: string;
    phone?: string;
    email?: string;
    contactInfo?: string;
    actionType?: string;
    description?: string;
    lotId?: string;
    appointmentDate?: string;
    updatedAt: number;
}

/** Структурированные критерии подбора недвижимости, извлечённые из диалога */
export interface PropertyPreferences {
    type?: string;
    bedrooms?: number;
    budgetMin?: number;
    budgetMax?: number;
    areaMin?: number;
    areaMax?: number;
    floorMin?: number;
    floorMax?: number;
    building?: string;
}

export interface ConversationSummary {
    /** Warm-tier: подробное резюме текущей темы и последних обменов (100–200 слов) */
    shortTermSummary: string;
    longTermSummary: string;
    /** Cold-tier: постоянные факты — имя, бюджет, тип жилья (до 150 слов, всегда в контексте) */
    broadSummary?: string;
    keyTopics: string[];
    importantFacts: string[];
    /** Структурированные критерии поиска недвижимости */
    propertyPreferences?: PropertyPreferences;
    /** Что пользователь явно отверг или не хочет */
    rejections?: string[];
    lastUpdated: number;
    tokens: number;
    stage?: 'browsing' | 'interested' | 'ready_to_contact' | 'negotiation';
    /** ID последнего сообщения, которое вошло в summary — якорь для предотвращения двойной суммаризации */
    lastSummarizedMessageId?: string;
}

export interface QuickReplyHistoryEntry {
    text: string;
    intent?: string;
    timestamp: number;
}

export interface SessionContext {
    version: number;
    contact?: SessionContactContext;
    messageHistory: MessageHistory[];
    summary: EnhancedSummary;
    semanticIndex: string[];
    lastActivity: number;
    totalMessages: number;
    summarizationPending: boolean;
    quickRepliesHistory?: QuickReplyHistoryEntry[];
}

export interface TokenCountResult {
    totalTokens: number;
    canFit: boolean;
    messagesToInclude: MessageHistory[];
    summaryTokens: number;
}

export interface EnhancedSummary extends ConversationSummary {
    clientIntent?: string;
    stage?: ConversationSummary['stage'];
}
