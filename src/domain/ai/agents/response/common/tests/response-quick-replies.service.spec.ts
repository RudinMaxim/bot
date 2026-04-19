import { ResponseQuickRepliesService } from '../services/response-quick-replies.service';
import type {
    AggregatedResults,
    QuickReplyCandidate,
    ResponseAgentInput,
} from '../types/response.types';

function buildInput(overrides?: {
    originalQuery?: string;
    quickRepliesHistory?: Array<{
        text?: string;
        intent?: string;
        timestamp?: number;
    }>;
}): ResponseAgentInput {
    return {
        sessionId: 'session-1',
        originalQuery: overrides?.originalQuery ?? 'покажи варианты',
        timestamp: new Date().toISOString(),
        metadata: {
            quickRepliesHistory: overrides?.quickRepliesHistory ?? [],
        } as ResponseAgentInput['metadata'],
    };
}

function buildAggregatedResults(): AggregatedResults {
    return {
        searchResults: [],
        analysisResults: [],
        sourceTypes: [],
        confidenceScores: [],
        questions: new Set<string>(),
        status: 'completed',
        meta: {
            agentsProcessed: 0,
            searchResultsCount: 0,
            hasAnalysis: false,
            urlIncluded: false,
        },
    };
}

function buildAggregatedResultsWithCards(): AggregatedResults {
    return {
        ...buildAggregatedResults(),
        analysisResults: [
            {
                taskId: 'a1',
                instruction: 'подборка',
                data: 'ok',
                confidence: 0.9,
                success: true,
                propertyCards: [
                    {
                        id: '101',
                        name: 'Лот 101',
                        area: 45,
                        price: 12_000_000,
                        priceOriginal: 12_500_000,
                        discount: 4,
                        floor: '5',
                        maxFloor: '12',
                        bedrooms: 1,
                        building: 'Волга',
                        ceilHeight: 3,
                        decoration: 'whitebox',
                        deadline: '2028',
                        detailUrl: '/apartments/101',
                    },
                    {
                        id: '202',
                        name: 'Лот 202',
                        area: 47,
                        price: 12_400_000,
                        priceOriginal: 12_900_000,
                        discount: 4,
                        floor: '6',
                        maxFloor: '12',
                        bedrooms: 1,
                        building: 'Волга',
                        ceilHeight: 3,
                        decoration: 'whitebox',
                        deadline: '2028',
                        detailUrl: '/apartments/202',
                    },
                ],
                metadata: {
                    executionTime: 10,
                    calculationsPerformed: [],
                    dataSources: ['api'],
                },
            },
        ],
        meta: {
            ...buildAggregatedResults().meta,
            hasAnalysis: true,
            agentsProcessed: 1,
        },
    };
}

describe('ResponseQuickRepliesService', () => {
    const service = new ResponseQuickRepliesService();

    it('keeps valid llm quick replies and supports check_availability intent', () => {
        const llmQuickReplies: QuickReplyCandidate[] = [
            {
                text: 'show_all_apartments',
                intent: 'check_availability',
                priority: 0.95,
            },
            { text: 'payment_options', intent: 'ask_payment', priority: 0.9 },
            { text: 'about_mr_group', intent: 'ask_developer', priority: 0.8 },
        ];

        const replies = service.ensureQuickReplies({
            llmQuickReplies,
            input: buildInput(),
            aggregatedResults: buildAggregatedResults(),
            locale: 'ru',
        });

        expect(replies).toHaveLength(3);
        expect(replies.map((reply) => reply.intent)).toEqual(
            expect.arrayContaining([
                'check_availability',
                'ask_payment',
                'ask_developer',
            ]),
        );
    });

    it('filters replies from history when alternatives exist', () => {
        const llmQuickReplies: QuickReplyCandidate[] = [
            { text: 'payment_options', intent: 'ask_payment', priority: 0.95 },
            { text: 'about_mr_group', intent: 'ask_developer', priority: 0.9 },
            {
                text: 'infrastructure_nearby',
                intent: 'ask_infrastructure',
                priority: 0.85,
            },
        ];

        const replies = service.ensureQuickReplies({
            llmQuickReplies,
            input: buildInput({
                quickRepliesHistory: [
                    {
                        text: 'payment_options',
                        intent: 'ask_payment',
                        timestamp: Date.now(),
                    },
                ],
            }),
            aggregatedResults: buildAggregatedResults(),
            locale: 'ru',
        });

        expect(replies.some((reply) => reply.text === 'payment_options')).toBe(
            false,
        );
    });

    it('does not allow deprecated developer and email quick replies', () => {
        const llmQuickReplies: QuickReplyCandidate[] = [
            {
                text: 'urban_blocks_infra',
                intent: 'ask_infrastructure',
                priority: 0.95,
            },
            {
                text: 'get_info_by_email',
                intent: 'request_consultation',
                priority: 0.94,
            },
            { text: 'about_mr_group', intent: 'ask_developer', priority: 0.9 },
        ];

        const replies = service.ensureQuickReplies({
            llmQuickReplies,
            input: buildInput({ originalQuery: 'расскажи о застройщике' }),
            aggregatedResults: buildAggregatedResults(),
            locale: 'ru',
        });

        expect(
            replies.some((reply) => reply.text === 'urban_blocks_infra'),
        ).toBe(false);
        expect(
            replies.some((reply) => reply.text === 'get_info_by_email'),
        ).toBe(false);
    });

    it('prioritizes developer follow-ups without urban blocks shortcut', () => {
        const replies = service.ensureQuickReplies({
            llmQuickReplies: [],
            input: buildInput({ originalQuery: 'расскажи о застройщике' }),
            aggregatedResults: buildAggregatedResults(),
            locale: 'ru',
        });

        expect(replies.some((reply) => reply.text === 'facts_mr_group')).toBe(
            true,
        );
        expect(
            replies.some((reply) => reply.text === 'infrastructure_nearby'),
        ).toBe(true);
        expect(
            replies.some((reply) => reply.text === 'urban_blocks_infra'),
        ).toBe(false);
    });

    it('uses leave_contacts instead of email option for contact intent', () => {
        const replies = service.ensureQuickReplies({
            llmQuickReplies: [],
            input: buildInput({
                originalQuery: 'получить информацию на email',
            }),
            aggregatedResults: buildAggregatedResults(),
            locale: 'ru',
        });

        expect(replies.some((reply) => reply.text === 'leave_contacts')).toBe(
            true,
        );
        expect(
            replies.some((reply) => reply.text === 'get_info_by_email'),
        ).toBe(false);
    });

    it('prioritizes cottages follow-up for cottage-related queries', () => {
        const replies = service.ensureQuickReplies({
            llmQuickReplies: [],
            input: buildInput({
                originalQuery: 'сколько будет построено таунхаусов?',
            }),
            aggregatedResults: buildAggregatedResults(),
            locale: 'ru',
        });

        expect(replies.some((reply) => reply.text === 'show_cottages')).toBe(
            true,
        );
    });

    it('adds excludePropertyIds payload for continue-search style replies', () => {
        const replies = service.ensureQuickReplies({
            llmQuickReplies: [
                {
                    text: 'continue_search',
                    intent: 'continue_search',
                    priority: 0.95,
                },
                {
                    text: 'find_similar_options',
                    intent: 'explore_similar',
                    priority: 0.9,
                },
                {
                    text: 'payment_options',
                    intent: 'ask_payment',
                    priority: 0.8,
                },
            ],
            input: buildInput({
                originalQuery: 'подбери еще варианты',
            }),
            aggregatedResults: buildAggregatedResultsWithCards(),
            locale: 'ru',
        });

        expect(replies[0]?.payload).toEqual({
            excludePropertyIds: ['101', '202'],
        });
        expect(replies[1]?.payload).toEqual({
            excludePropertyIds: ['101', '202'],
        });
        expect(replies[2]?.payload).toBeUndefined();
    });
});
