import type { ResponseConversationStage } from '../constants/response.const';

export type BudgetRange = {
    min?: number;
    max?: number;
};

export const QUICK_REPLY_NEED = {
    SEARCH: 'search',
    PAYMENT: 'payment',
    DEVELOPER: 'developer',
    TRANSPORT: 'transport',
    INFRASTRUCTURE: 'infrastructure',
    CONSTRUCTION: 'construction',
    LAYOUT: 'layout',
    PARKING: 'parking',
    CONTACT: 'contact',
    EMAIL: 'email',
    SIMILAR: 'similar',
    COTTAGES: 'cottages',
    DISCOUNT: 'discount',
} as const;

export type QuickReplyNeed =
    (typeof QUICK_REPLY_NEED)[keyof typeof QUICK_REPLY_NEED];

export interface QuickReplyContext {
    budget?: BudgetRange;
    stage?: ResponseConversationStage;
    needs: Set<QuickReplyNeed>;
    hasResults: boolean;
    hasAnalysis: boolean;
    shouldClarify: boolean;
    requiresContact: boolean;
}

export type ResponseUiHints = {
    contactFormRequired: boolean;
    contactFormId?: string;
    siteActionsAvailable: boolean;
    siteActionTypes: string[];
};
