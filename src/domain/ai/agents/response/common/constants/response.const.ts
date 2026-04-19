export const RESPONSE_TEXTS_PREFIX = 'content.ai.response' as const;

export const RESPONSE_CONFIDENCE_THRESHOLD = {
    HIGH: 0.8,
    MEDIUM: 0.5,
} as const;

export const QUICK_REPLY_INTENT = {
    EXPLORE_SIMILAR: 'explore_similar',
    CHECK_AVAILABILITY: 'check_availability',
    ASK_PAYMENT: 'ask_payment',
    ASK_LOCATION: 'ask_location',
    ASK_FEATURES: 'ask_features',
    ASK_INFRASTRUCTURE: 'ask_infrastructure',
    ASK_DEVELOPER: 'ask_developer',
    ASK_CONSTRUCTION: 'ask_construction',
    REQUEST_CONSULTATION: 'request_consultation',
    CONTINUE_SEARCH: 'continue_search',
} as const;

export type QuickReplyIntent =
    (typeof QUICK_REPLY_INTENT)[keyof typeof QUICK_REPLY_INTENT];

export const VALID_QUICK_REPLY_INTENTS = Object.values(
    QUICK_REPLY_INTENT,
) as ReadonlyArray<QuickReplyIntent>;

export const VALID_QUICK_REPLY_INTENT_SET = new Set<QuickReplyIntent>(
    VALID_QUICK_REPLY_INTENTS,
);

export const QUICK_REPLY_TEXT = {
    SHOW_ALL_APARTMENTS: 'show_all_apartments',
    SIMILAR_OPTIONS: 'similar_options',
    MORTGAGE_DISCOUNTS: 'mortgage_discounts',
    TRANSPORT_AREA: 'transport_area',
    LAYOUTS_FINISHING: 'layouts_finishing',
    INFRASTRUCTURE_NEARBY: 'infrastructure_nearby',
    ABOUT_MR_GROUP: 'about_mr_group',
    FACTS_MR_GROUP: 'facts_mr_group',
    CONSTRUCTION_PROGRESS: 'construction_progress',
    CONTINUE_SEARCH: 'continue_search',
    FACTS_MYS: 'facts_mys',
    PROS_CONS_MYS: 'pros_cons_mys',
    COMPLETION_TIMELINES: 'completion_timelines',
    PARKING_STORAGE: 'parking_storage',
    COMPARE_OTHER: 'compare_other',
    CURATE_CRITERIA: 'curate_criteria',
    PAYMENT_OPTIONS: 'payment_options',
    LEARN_CONSTRUCTION_PROGRESS: 'learn_construction_progress',
    LEAVE_CONTACTS_FOR_CONSULTATION: 'leave_contacts_for_consultation',
    LEAVE_CONTACTS: 'leave_contacts',
    LEARN_DISCOUNTS: 'learn_discounts',
    DISCUSS_PURCHASE_TERMS: 'discuss_purchase_terms',
    TELL_MORTGAGE_DISCOUNTS: 'tell_mortgage_discounts',
    HOW_TO_GET_THERE: 'how_to_get_there',
    CONSTRUCTION_STAGES: 'construction_stages',
    NEARBY_INFRASTRUCTURE: 'nearby_infrastructure',
    SHOW_LAYOUTS: 'show_layouts',
    FIND_SIMILAR_OPTIONS: 'find_similar_options',
    SHOW_COTTAGES: 'show_cottages',
} as const;

export const DEPRECATED_QUICK_REPLY_TEXT = {
    URBAN_BLOCKS_INFRA: 'urban_blocks_infra',
    GET_INFO_BY_EMAIL: 'get_info_by_email',
} as const;

export const RESPONSE_STAGE = {
    BROWSING: 'browsing',
    INTERESTED: 'interested',
    READY_TO_CONTACT: 'ready_to_contact',
    NEGOTIATION: 'negotiation',
} as const;

export type ResponseConversationStage =
    (typeof RESPONSE_STAGE)[keyof typeof RESPONSE_STAGE];

export const QUICK_REPLY_KEYS = Object.values(
    QUICK_REPLY_TEXT,
) as readonly string[];

export type QuickReplyTextKey =
    (typeof QUICK_REPLY_TEXT)[keyof typeof QUICK_REPLY_TEXT];

export const QUICK_REPLY_KEY_SET = new Set<string>(QUICK_REPLY_KEYS);

export const RECENT_QUICK_REPLY_INTENTS_LIMIT = 6;
export const DEFAULT_QUICK_REPLY_LIMIT = 3;

export const RESPONSE_PROMPT_LIMITS = {
    MAX_CONVERSATION_CONTEXT_CHARS: 1200,
    MAX_QUICK_REPLY_EXAMPLES_CHARS: 320,
    MAX_AGENT_DATA_CHARS: 4000,
    MAX_TEXT_CHARS: 400,
    MAX_QUERY_CHARS: 240,
    MAX_SUMMARIZED_RESPONSE_CHARS: 800,
    MAX_SEARCH_RESULTS: 4,
    MAX_SEARCH_DOCS_PER_RESULT: 4,
    MAX_DOC_SNIPPET_CHARS: 280,
    MAX_ANALYSIS_RESULTS: 4,
    MAX_ANALYSIS_DATA_CHARS: 900,
    MAX_ANALYSIS_QUESTIONS: 6,
    MAX_PROPERTY_CARDS_PER_RESULT: 6,
    MAX_QUESTIONS: 20,
    MAX_SOURCE_TYPES: 12,
    MAX_CONFIDENCE_SCORES: 30,
} as const;
