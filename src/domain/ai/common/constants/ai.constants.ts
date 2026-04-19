import { AGENT_PRIORITY } from 'src/shared/agents';

export { AGENT_PRIORITY };

export const AI_STATUS = {
    CANCELLED: 'cancelled',
    COMPLETED: 'completed',
    PARTIAL: 'partial',
    FAILED: 'failed',
    UNKNOWN: 'unknown',
} as const;

export type AiStatus = (typeof AI_STATUS)[keyof typeof AI_STATUS];

export const SOURCE_TYPE = {
    SEARCH: 'search',
    CONTEXT: 'context',
    CLARIFICATION: 'clarification',
} as const;

export const CONFIDENCE = {
    ACTION_COMPLETED: 0.9,
    WITH_METRICS: 0.8,
    PARTIAL: 0.6,
    DEFAULT: 0.5,
    SITE_ASSISTANT_FAIL: 0.5,
    CLARIFICATION: 0.4,
    FAILED: 0.3,
    AGENT_FAILURE: 0.2,
    CONFIRMATION: 0.95,
} as const;

export const FAST_PATH = {
    SUMMARY_MATCH: 0.4,
    FACTS_MATCH: 0.3,
    CONTACT_KEYWORDS: 0.4,
    HISTORY_MATCH: 0.2,
    THRESHOLD: 0.7,
} as const;

export const AGENT_NAME = {
    SEARCH: 'search_agent',
    COORDINATOR: 'coordinator_agent',
    RESPONSE: 'response_agent',
} as const;

export const ASSISTANT_MODE = {
    ANSWER: 'answer',
    CLARIFY: 'clarify',
    PARTIAL_WITH_SPECIALIST: 'partial_with_specialist',
    ROUTE_TO_SPECIALIST: 'route_to_specialist',
} as const;

export const STOP_WORDS = new Set([
    'что',
    'как',
    'это',
    'где',
    'когда',
    'для',
    'под',
    'над',
    'при',
    'или',
    'если',
    'все',
    'ещё',
    'уже',
    'там',
    'тут',
    'вот',
    'так',
    'еще',
    'без',
    'про',
    'перед',
    'меня',
    'мне',
]);
