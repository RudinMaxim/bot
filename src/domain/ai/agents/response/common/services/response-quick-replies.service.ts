import { Injectable } from '@nestjs/common';
import type { SupportedLocale } from 'src/domain/ai/common/utils';
import {
    DEFAULT_QUICK_REPLY_LIMIT,
    DEPRECATED_QUICK_REPLY_TEXT,
    QUICK_REPLY_INTENT,
    QUICK_REPLY_KEY_SET,
    QUICK_REPLY_TEXT,
    RECENT_QUICK_REPLY_INTENTS_LIMIT,
    RESPONSE_STAGE,
    VALID_QUICK_REPLY_INTENT_SET,
} from '../constants/response.const';
import {
    QUICK_REPLY_NEED,
    type BudgetRange,
    type QuickReplyContext,
    type QuickReplyNeed,
} from '../types/response-internal.types';
import type {
    AggregatedResults,
    QuickReply,
    QuickReplyCandidate,
    QuickReplyIntent,
    ResponseAgentInput,
} from '../types/response.types';

type LocalePatternMap = Readonly<Record<SupportedLocale, RegExp>>;

type NeedPatternRule = {
    readonly need: QuickReplyNeed;
    readonly patterns: LocalePatternMap;
};

type BudgetKeywordGroup = Readonly<{
    min: readonly string[];
    max: readonly string[];
}>;

const DISALLOWED_QUICK_REPLY_KEYS = new Set<string>(
    Object.values(DEPRECATED_QUICK_REPLY_TEXT),
);

const QUICK_REPLY_PRIORITY = {
    CONTACT_REQUIRED: 0.96,
    CONTACT_READY: 0.95,
    VERY_HIGH: 0.93,
    HIGH: 0.9,
    HIGH_SECONDARY: 0.88,
    INFRA_DEVELOPER: 0.87,
    TRANSPORT: 0.86,
    STRONG: 0.84,
    HIGH_DEFAULT: 0.83,
    PAYMENT_WITH_RESULTS: 0.82,
    CONTINUE_RELEVANT: 0.81,
    STAGE_INTERESTED: 0.8,
    SUPPORT_PAYMENT: 0.79,
    EMPTY_RESULTS: 0.78,
    BROWSING_PAYMENT: 0.76,
    SIMILAR_WITH_RESULTS: 0.9,
    SIMILAR_WITHOUT_RESULTS: 0.75,
    LOCATION_BASE: 0.74,
    CONSTRUCTION_BASE: 0.73,
    FEATURES_BASE: 0.72,
    INFRA_BASE: 0.71,
    FEATURES_EXTRA: 0.7,
    CONTINUE_BASE: 0.7,
    DEVELOPER_BASE: 0.69,
    CONSTRUCTION_FALLBACK: 0.68,
} as const;

const BASE_NEED_PATTERNS: readonly NeedPatternRule[] = [
    {
        need: QUICK_REPLY_NEED.SEARCH,
        patterns: {
            ru: /(покажи|подбери|подбор|кварти|таунхаус|коттедж)/,
            en: /(show|find|pick|select|search).*(apartment|flat|townhouse|cottage|villa)|\b(apartment|flat|townhouse|cottage|villa)\b/,
        },
    },
    {
        need: QUICK_REPLY_NEED.PAYMENT,
        patterns: {
            ru: /(ипотек|оплат|платеж|рассроч|скидк|дешевле)/,
            en: /(mortgage|payment|installment|discount|cheaper|price)/,
        },
    },
    {
        need: QUICK_REPLY_NEED.DEVELOPER,
        patterns: {
            ru: /(застройщ|mr[\s-]?group|mrgroup|mr-?group)/,
            en: /(developer|mr[\s-]?group|mrgroup)/,
        },
    },
    {
        need: QUICK_REPLY_NEED.TRANSPORT,
        patterns: {
            ru: /(транспорт|как добрат|маршрут|окружен)/,
            en: /(transport|how to get|route|commute|access)/,
        },
    },
    {
        need: QUICK_REPLY_NEED.INFRASTRUCTURE,
        patterns: {
            ru: /(инфраструкт|урбан блок)/,
            en: /(infrastructure|amenit|urban block)/,
        },
    },
    {
        need: QUICK_REPLY_NEED.CONSTRUCTION,
        patterns: {
            ru: /(этап|строит|ход|сроки сдачи)/,
            en: /(construction|build|progress|timeline|completion)/,
        },
    },
    {
        need: QUICK_REPLY_NEED.LAYOUT,
        patterns: {
            ru: /(планиров|отделк|площад)/,
            en: /(layout|floor plan|finish|area)/,
        },
    },
    {
        need: QUICK_REPLY_NEED.PARKING,
        patterns: {
            ru: /(паркинг|кладов)/,
            en: /(parking|storage)/,
        },
    },
    {
        need: QUICK_REPLY_NEED.CONTACT,
        patterns: {
            ru: /(контакт|связат|телефон|email|почт)/,
            en: /(contact|call|phone|email|reach)/,
        },
    },
    {
        need: QUICK_REPLY_NEED.SIMILAR,
        patterns: {
            ru: /(похож|подходящ)/,
            en: /(similar|alternative|suitable)/,
        },
    },
    {
        need: QUICK_REPLY_NEED.COTTAGES,
        patterns: {
            ru: /(коттедж|таунхаус|вилл)/,
            en: /(cottage|townhouse|villa)/,
        },
    },
];

const DERIVED_NEED_PATTERNS: readonly NeedPatternRule[] = [
    {
        need: QUICK_REPLY_NEED.DISCOUNT,
        patterns: {
            ru: /скидк/,
            en: /discount/,
        },
    },
    {
        need: QUICK_REPLY_NEED.SIMILAR,
        patterns: {
            ru: /дешевле|до\s+\d/,
            en: /cheaper|under\s+\d/,
        },
    },
    {
        need: QUICK_REPLY_NEED.EMAIL,
        patterns: {
            ru: /email|почт/,
            en: /email/,
        },
    },
];

const BUDGET_PATTERNS: Readonly<Record<SupportedLocale, RegExp>> = {
    ru: /(от|до|не\s+менее|не\s+более|дороже|дешевле|больше|меньше)?\s*(\d+(?:[.,]\d+)?)\s*(?:млн|миллион)/gi,
    en: /(from|to|at\s+least|no\s+less\s+than|no\s+more\s+than|under|over|less\s+than|more\s+than)?\s*(\d+(?:[.,]\d+)?)\s*(?:m|mn|mln|million)\b/gi,
};

const BUDGET_KEYWORDS: Readonly<Record<SupportedLocale, BudgetKeywordGroup>> = {
    ru: {
        min: ['от', 'не менее', 'дороже', 'больше'],
        max: ['до', 'не более', 'меньше', 'дешевле'],
    },
    en: {
        min: ['from', 'at least', 'no less', 'over', 'more than', 'above'],
        max: ['to', 'at most', 'no more', 'under', 'less than', 'below'],
    },
};

@Injectable()
export class ResponseQuickRepliesService {
    ensureQuickReplies(params: {
        llmQuickReplies: QuickReplyCandidate[] | undefined;
        input: ResponseAgentInput;
        aggregatedResults: AggregatedResults;
        locale: SupportedLocale;
        limit?: number;
    }): QuickReply[] {
        const { llmQuickReplies, input, aggregatedResults, locale, limit } =
            params;
        const targetLimit = limit ?? DEFAULT_QUICK_REPLY_LIMIT;
        const history = this.getRecentQuickReplyHistory(input);
        const context = this.buildQuickReplyContext(
            input,
            aggregatedResults,
            locale,
        );

        const validated =
            llmQuickReplies && llmQuickReplies.length > 0
                ? this.filterOutHistory(
                      this.validateQuickReplies(
                          llmQuickReplies,
                          context,
                          locale,
                      ),
                      history.texts,
                  )
                : [];

        const fallback = this.filterOutHistory(
            this.generateFallbackQuickReplies(context),
            history.texts,
        );

        const merged = this.mergeQuickReplies(
            validated,
            fallback,
            targetLimit,
            history.intents,
        );
        if (merged.length > 0) {
            return this.attachContextPayloads(merged, aggregatedResults);
        }

        return this.attachContextPayloads(
            this.mergeQuickReplies(
                [],
                this.generateFallbackQuickReplies(context),
                targetLimit,
            ),
            aggregatedResults,
        );
    }

    private buildQuickReplyContext(
        input: ResponseAgentInput,
        aggregatedResults: AggregatedResults,
        locale: SupportedLocale,
    ): QuickReplyContext {
        const needs = this.detectUserNeeds(input.originalQuery, locale);
        const stage = input.metadata?.sessionContext?.summary?.stage;
        const requiresContact =
            needs.has(QUICK_REPLY_NEED.CONTACT) ||
            needs.has(QUICK_REPLY_NEED.EMAIL) ||
            stage === RESPONSE_STAGE.READY_TO_CONTACT;

        return {
            budget: this.extractBudgetRange(input.originalQuery, locale),
            stage,
            needs,
            hasResults: aggregatedResults.searchResults.length > 0,
            hasAnalysis: aggregatedResults.analysisResults.length > 0,
            shouldClarify: Boolean(input.metadata?.shouldClarify),
            requiresContact,
        };
    }

    private validateQuickReplies(
        replies: QuickReplyCandidate[],
        context: QuickReplyContext,
        locale: SupportedLocale,
    ): QuickReply[] {
        const normalized = replies
            .filter((reply) => this.isValidQuickReply(reply, context, locale))
            .map((reply) => this.normalizeQuickReply(reply));

        return this.deduplicateByIntentAndText(normalized);
    }

    private isValidQuickReply(
        reply: QuickReplyCandidate,
        context: QuickReplyContext,
        locale: SupportedLocale,
    ): boolean {
        const trimmed = reply.text?.trim();
        if (!trimmed || !QUICK_REPLY_KEY_SET.has(trimmed)) {
            return false;
        }

        if (DISALLOWED_QUICK_REPLY_KEYS.has(trimmed)) {
            return false;
        }

        if (!this.isBudgetAligned(trimmed, context.budget, locale)) {
            return false;
        }

        return (
            trimmed.length > 0 &&
            trimmed.length <= 100 &&
            VALID_QUICK_REPLY_INTENT_SET.has(reply.intent)
        );
    }

    private normalizeQuickReply(reply: QuickReplyCandidate): QuickReply {
        return {
            text: reply.text.trim().substring(0, 45),
            intent: reply.intent,
            priority: this.normalizePriority(reply.priority),
            payload: reply.payload,
        };
    }

    private normalizePriority(priority: number | undefined): number {
        if (priority === undefined) return 0.5;
        return Math.max(0.1, Math.min(1.0, priority));
    }

    private generateFallbackQuickReplies(
        context: QuickReplyContext,
    ): QuickReply[] {
        const replies: QuickReply[] = [
            this.createQuickReply(
                QUICK_REPLY_TEXT.SIMILAR_OPTIONS,
                QUICK_REPLY_INTENT.EXPLORE_SIMILAR,
                context.hasResults
                    ? QUICK_REPLY_PRIORITY.SIMILAR_WITH_RESULTS
                    : QUICK_REPLY_PRIORITY.SIMILAR_WITHOUT_RESULTS,
            ),
            this.createQuickReply(
                QUICK_REPLY_TEXT.MORTGAGE_DISCOUNTS,
                QUICK_REPLY_INTENT.ASK_PAYMENT,
                context.hasAnalysis || context.hasResults
                    ? QUICK_REPLY_PRIORITY.PAYMENT_WITH_RESULTS
                    : QUICK_REPLY_PRIORITY.EMPTY_RESULTS,
            ),
            this.createQuickReply(
                QUICK_REPLY_TEXT.TRANSPORT_AREA,
                QUICK_REPLY_INTENT.ASK_LOCATION,
                QUICK_REPLY_PRIORITY.LOCATION_BASE,
            ),
            this.createQuickReply(
                QUICK_REPLY_TEXT.LAYOUTS_FINISHING,
                QUICK_REPLY_INTENT.ASK_FEATURES,
                QUICK_REPLY_PRIORITY.FEATURES_BASE,
            ),
            this.createQuickReply(
                QUICK_REPLY_TEXT.INFRASTRUCTURE_NEARBY,
                QUICK_REPLY_INTENT.ASK_INFRASTRUCTURE,
                QUICK_REPLY_PRIORITY.INFRA_BASE,
            ),
            this.createQuickReply(
                QUICK_REPLY_TEXT.ABOUT_MR_GROUP,
                QUICK_REPLY_INTENT.ASK_DEVELOPER,
                QUICK_REPLY_PRIORITY.DEVELOPER_BASE,
            ),
            this.createQuickReply(
                QUICK_REPLY_TEXT.CONSTRUCTION_PROGRESS,
                QUICK_REPLY_INTENT.ASK_CONSTRUCTION,
                QUICK_REPLY_PRIORITY.CONSTRUCTION_FALLBACK,
            ),
            this.createQuickReply(
                QUICK_REPLY_TEXT.CONTINUE_SEARCH,
                QUICK_REPLY_INTENT.CONTINUE_SEARCH,
                context.shouldClarify
                    ? QUICK_REPLY_PRIORITY.TRANSPORT
                    : QUICK_REPLY_PRIORITY.CONTINUE_BASE,
            ),
            this.createQuickReply(
                QUICK_REPLY_TEXT.FACTS_MYS,
                QUICK_REPLY_INTENT.ASK_FEATURES,
                QUICK_REPLY_PRIORITY.FEATURES_EXTRA,
            ),
            this.createQuickReply(
                QUICK_REPLY_TEXT.PROS_CONS_MYS,
                QUICK_REPLY_INTENT.ASK_INFRASTRUCTURE,
                QUICK_REPLY_PRIORITY.DEVELOPER_BASE,
            ),
            this.createQuickReply(
                QUICK_REPLY_TEXT.COMPLETION_TIMELINES,
                QUICK_REPLY_INTENT.ASK_CONSTRUCTION,
                QUICK_REPLY_PRIORITY.CONSTRUCTION_BASE,
            ),
            this.createQuickReply(
                QUICK_REPLY_TEXT.PARKING_STORAGE,
                QUICK_REPLY_INTENT.ASK_INFRASTRUCTURE,
                QUICK_REPLY_PRIORITY.FEATURES_BASE,
            ),
            this.createQuickReply(
                QUICK_REPLY_TEXT.COMPARE_OTHER,
                QUICK_REPLY_INTENT.CONTINUE_SEARCH,
                QUICK_REPLY_PRIORITY.CONTINUE_BASE,
            ),
        ];

        this.addStageBasedReplies(replies, context.stage);
        this.addNeedBasedReplies(replies, context);

        if (!context.hasResults && !context.hasAnalysis) {
            replies.push(
                this.createQuickReply(
                    QUICK_REPLY_TEXT.CURATE_CRITERIA,
                    QUICK_REPLY_INTENT.CONTINUE_SEARCH,
                    QUICK_REPLY_PRIORITY.EMPTY_RESULTS,
                ),
            );
        }

        return this.deduplicateByText(replies)
            .filter((reply) => !DISALLOWED_QUICK_REPLY_KEYS.has(reply.text))
            .sort((a, b) => b.priority - a.priority);
    }

    private addStageBasedReplies(
        replies: QuickReply[],
        stage: QuickReplyContext['stage'],
    ): void {
        switch (stage) {
            case RESPONSE_STAGE.BROWSING:
                replies.push(
                    this.createQuickReply(
                        QUICK_REPLY_TEXT.PAYMENT_OPTIONS,
                        QUICK_REPLY_INTENT.ASK_PAYMENT,
                        QUICK_REPLY_PRIORITY.BROWSING_PAYMENT,
                    ),
                );
                break;
            case RESPONSE_STAGE.INTERESTED:
                replies.push(
                    this.createQuickReply(
                        QUICK_REPLY_TEXT.LEARN_CONSTRUCTION_PROGRESS,
                        QUICK_REPLY_INTENT.ASK_CONSTRUCTION,
                        QUICK_REPLY_PRIORITY.STAGE_INTERESTED,
                    ),
                    this.createQuickReply(
                        QUICK_REPLY_TEXT.LEAVE_CONTACTS_FOR_CONSULTATION,
                        QUICK_REPLY_INTENT.REQUEST_CONSULTATION,
                        QUICK_REPLY_PRIORITY.HIGH_SECONDARY,
                    ),
                );
                break;
            case RESPONSE_STAGE.READY_TO_CONTACT:
                replies.push(
                    this.createQuickReply(
                        QUICK_REPLY_TEXT.LEAVE_CONTACTS,
                        QUICK_REPLY_INTENT.REQUEST_CONSULTATION,
                        QUICK_REPLY_PRIORITY.CONTACT_READY,
                    ),
                    this.createQuickReply(
                        QUICK_REPLY_TEXT.LEARN_DISCOUNTS,
                        QUICK_REPLY_INTENT.ASK_PAYMENT,
                        QUICK_REPLY_PRIORITY.EMPTY_RESULTS,
                    ),
                );
                break;
            case RESPONSE_STAGE.NEGOTIATION:
                replies.push(
                    this.createQuickReply(
                        QUICK_REPLY_TEXT.DISCUSS_PURCHASE_TERMS,
                        QUICK_REPLY_INTENT.ASK_PAYMENT,
                        QUICK_REPLY_PRIORITY.STRONG,
                    ),
                );
                break;
        }
    }

    private addNeedBasedReplies(
        replies: QuickReply[],
        context: QuickReplyContext,
    ): void {
        const { needs, requiresContact, hasResults } = context;

        if (needs.has(QUICK_REPLY_NEED.PAYMENT)) {
            replies.push(
                this.createQuickReply(
                    QUICK_REPLY_TEXT.TELL_MORTGAGE_DISCOUNTS,
                    QUICK_REPLY_INTENT.ASK_PAYMENT,
                    QUICK_REPLY_PRIORITY.VERY_HIGH,
                ),
                this.createQuickReply(
                    QUICK_REPLY_TEXT.PAYMENT_OPTIONS,
                    QUICK_REPLY_INTENT.ASK_PAYMENT,
                    QUICK_REPLY_PRIORITY.HIGH_SECONDARY,
                ),
            );
        }

        if (needs.has(QUICK_REPLY_NEED.DEVELOPER)) {
            replies.push(
                this.createQuickReply(
                    QUICK_REPLY_TEXT.FACTS_MR_GROUP,
                    QUICK_REPLY_INTENT.ASK_DEVELOPER,
                    QUICK_REPLY_PRIORITY.VERY_HIGH,
                ),
                this.createQuickReply(
                    QUICK_REPLY_TEXT.INFRASTRUCTURE_NEARBY,
                    QUICK_REPLY_INTENT.ASK_INFRASTRUCTURE,
                    QUICK_REPLY_PRIORITY.INFRA_DEVELOPER,
                ),
                this.createQuickReply(
                    QUICK_REPLY_TEXT.COMPARE_OTHER,
                    QUICK_REPLY_INTENT.CONTINUE_SEARCH,
                    QUICK_REPLY_PRIORITY.CONTINUE_RELEVANT,
                ),
            );
        }

        if (needs.has(QUICK_REPLY_NEED.TRANSPORT)) {
            replies.push(
                this.createQuickReply(
                    QUICK_REPLY_TEXT.HOW_TO_GET_THERE,
                    QUICK_REPLY_INTENT.ASK_LOCATION,
                    QUICK_REPLY_PRIORITY.TRANSPORT,
                ),
            );
        }

        if (needs.has(QUICK_REPLY_NEED.CONSTRUCTION)) {
            replies.push(
                this.createQuickReply(
                    QUICK_REPLY_TEXT.CONSTRUCTION_STAGES,
                    QUICK_REPLY_INTENT.ASK_CONSTRUCTION,
                    QUICK_REPLY_PRIORITY.TRANSPORT,
                ),
                this.createQuickReply(
                    QUICK_REPLY_TEXT.COMPLETION_TIMELINES,
                    QUICK_REPLY_INTENT.ASK_CONSTRUCTION,
                    QUICK_REPLY_PRIORITY.PAYMENT_WITH_RESULTS,
                ),
            );
        }

        if (needs.has(QUICK_REPLY_NEED.INFRASTRUCTURE)) {
            replies.push(
                this.createQuickReply(
                    QUICK_REPLY_TEXT.NEARBY_INFRASTRUCTURE,
                    QUICK_REPLY_INTENT.ASK_INFRASTRUCTURE,
                    QUICK_REPLY_PRIORITY.HIGH_DEFAULT,
                ),
            );
        }

        if (needs.has(QUICK_REPLY_NEED.LAYOUT)) {
            replies.push(
                this.createQuickReply(
                    QUICK_REPLY_TEXT.SHOW_LAYOUTS,
                    QUICK_REPLY_INTENT.ASK_FEATURES,
                    QUICK_REPLY_PRIORITY.STRONG,
                ),
            );
        }

        if (needs.has(QUICK_REPLY_NEED.PARKING)) {
            replies.push(
                this.createQuickReply(
                    QUICK_REPLY_TEXT.PARKING_STORAGE,
                    QUICK_REPLY_INTENT.ASK_INFRASTRUCTURE,
                    QUICK_REPLY_PRIORITY.STRONG,
                ),
            );
        }

        if (needs.has(QUICK_REPLY_NEED.DISCOUNT)) {
            replies.push(
                this.createQuickReply(
                    QUICK_REPLY_TEXT.LEARN_DISCOUNTS,
                    QUICK_REPLY_INTENT.ASK_PAYMENT,
                    QUICK_REPLY_PRIORITY.HIGH_DEFAULT,
                ),
            );
        }

        if (
            needs.has(QUICK_REPLY_NEED.SIMILAR) ||
            (hasResults && needs.has(QUICK_REPLY_NEED.SEARCH))
        ) {
            replies.push(
                this.createQuickReply(
                    QUICK_REPLY_TEXT.FIND_SIMILAR_OPTIONS,
                    QUICK_REPLY_INTENT.EXPLORE_SIMILAR,
                    QUICK_REPLY_PRIORITY.HIGH,
                ),
            );
        }

        if (needs.has(QUICK_REPLY_NEED.COTTAGES)) {
            replies.push(
                this.createQuickReply(
                    QUICK_REPLY_TEXT.SHOW_COTTAGES,
                    QUICK_REPLY_INTENT.CONTINUE_SEARCH,
                    QUICK_REPLY_PRIORITY.HIGH,
                ),
                this.createQuickReply(
                    QUICK_REPLY_TEXT.PAYMENT_OPTIONS,
                    QUICK_REPLY_INTENT.ASK_PAYMENT,
                    QUICK_REPLY_PRIORITY.SUPPORT_PAYMENT,
                ),
            );
        }

        if (requiresContact) {
            replies.push(
                this.createQuickReply(
                    QUICK_REPLY_TEXT.LEAVE_CONTACTS,
                    QUICK_REPLY_INTENT.REQUEST_CONSULTATION,
                    QUICK_REPLY_PRIORITY.CONTACT_REQUIRED,
                ),
            );
        }
    }

    private extractBudgetRange(
        text: string,
        locale: SupportedLocale,
    ): BudgetRange | undefined {
        return this.parseBudgetRange(text, locale);
    }

    private isBudgetAligned(
        replyText: string,
        budget: BudgetRange | undefined,
        locale: SupportedLocale,
    ): boolean {
        if (!budget) return true;
        const replyRange = this.parseBudgetRange(replyText, locale);
        if (!replyRange) return true;

        const queryMin = budget.min ?? budget.max;
        const queryMax = budget.max ?? budget.min;
        const replyMin = replyRange.min ?? replyRange.max;
        const replyMax = replyRange.max ?? replyRange.min;

        if (queryMin && replyMax && replyMax < queryMin * 0.7) {
            return false;
        }
        if (queryMax && replyMin && replyMin > queryMax * 1.3) {
            return false;
        }

        return true;
    }

    private parseBudgetRange(
        text: string,
        locale: SupportedLocale,
    ): BudgetRange | undefined {
        const textLower = text.toLowerCase();
        const patterns =
            locale === 'en'
                ? [BUDGET_PATTERNS.en, BUDGET_PATTERNS.ru]
                : [BUDGET_PATTERNS.ru, BUDGET_PATTERNS.en];

        let matches: RegExpMatchArray[] = [];
        for (const pattern of patterns) {
            matches = [...textLower.matchAll(pattern)];
            if (matches.length > 0) break;
        }
        if (matches.length === 0) return undefined;

        const range: BudgetRange = {};

        for (const match of matches) {
            const keyword = match[1]?.trim();
            const value = Number.parseFloat(match[2]?.replace(',', '.') ?? '0');
            if (Number.isNaN(value)) continue;

            if (keyword && this.hasBudgetKeyword(keyword, locale, 'min')) {
                range.min = Math.max(range.min ?? value, value);
                continue;
            }
            if (keyword && this.hasBudgetKeyword(keyword, locale, 'max')) {
                range.max =
                    range.max === undefined
                        ? value
                        : Math.min(range.max, value);
                continue;
            }

            range.min = Math.max(range.min ?? value, value);
            range.max =
                range.max === undefined ? value : Math.min(range.max, value);
        }

        if (range.min === undefined && range.max === undefined) {
            return undefined;
        }

        return range;
    }

    private hasBudgetKeyword(
        keyword: string,
        locale: SupportedLocale,
        side: keyof BudgetKeywordGroup,
    ): boolean {
        const localizedKeywords = BUDGET_KEYWORDS[locale][side];
        const fallbackLocale: SupportedLocale = locale === 'en' ? 'ru' : 'en';
        const fallbackKeywords = BUDGET_KEYWORDS[fallbackLocale][side];

        return [...localizedKeywords, ...fallbackKeywords].some((candidate) =>
            keyword.includes(candidate),
        );
    }

    private mergeQuickReplies(
        primary: QuickReply[],
        fallback: QuickReply[],
        limit: number,
        avoidIntents?: Set<QuickReplyIntent>,
    ): QuickReply[] {
        const result: QuickReply[] = [];
        const seenText = new Set<string>();
        const seenIntent = new Set<QuickReplyIntent>();

        const tryAdd = (
            reply: QuickReply,
            enforceUniqueIntent: boolean,
            avoidRecentIntents: boolean,
        ) => {
            if (result.length >= limit) return;

            const textKey = reply.text.trim().toLowerCase();
            if (seenText.has(textKey)) return;
            if (enforceUniqueIntent && seenIntent.has(reply.intent)) return;
            if (avoidRecentIntents && avoidIntents?.has(reply.intent)) return;

            seenText.add(textKey);
            seenIntent.add(reply.intent);
            result.push(reply);
        };

        const sortedPrimary = [...primary].sort(
            (a, b) => b.priority - a.priority,
        );
        sortedPrimary.forEach((reply) => tryAdd(reply, true, true));

        const sortedFallback = [...fallback].sort(
            (a, b) => b.priority - a.priority,
        );
        sortedFallback.forEach((reply) => tryAdd(reply, true, true));

        if (result.length < limit) {
            sortedPrimary.forEach((reply) => tryAdd(reply, true, false));
            sortedFallback.forEach((reply) => tryAdd(reply, true, false));
        }

        if (result.length < limit) {
            sortedFallback.forEach((reply) => tryAdd(reply, false, false));
        }

        return result.slice(0, limit);
    }

    private filterOutHistory(
        replies: QuickReply[],
        historyTexts: Set<string>,
    ): QuickReply[] {
        if (historyTexts.size === 0) return replies;

        return replies.filter(
            (reply) => !historyTexts.has(reply.text.trim().toLowerCase()),
        );
    }

    private detectUserNeeds(
        query: string,
        locale: SupportedLocale,
    ): Set<QuickReplyNeed> {
        const normalizedQuery = query.toLowerCase();
        const needs = new Set<QuickReplyNeed>();

        for (const rule of BASE_NEED_PATTERNS) {
            if (
                this.matchesNeedPattern(normalizedQuery, locale, rule.patterns)
            ) {
                needs.add(rule.need);
            }
        }

        for (const rule of DERIVED_NEED_PATTERNS) {
            if (
                this.matchesNeedPattern(normalizedQuery, locale, rule.patterns)
            ) {
                needs.add(rule.need);
            }
        }

        return needs;
    }

    private matchesNeedPattern(
        normalizedQuery: string,
        locale: SupportedLocale,
        patterns: LocalePatternMap,
    ): boolean {
        if (patterns[locale].test(normalizedQuery)) {
            return true;
        }

        const fallbackLocale: SupportedLocale = locale === 'en' ? 'ru' : 'en';
        return patterns[fallbackLocale].test(normalizedQuery);
    }

    private deduplicateByIntentAndText(replies: QuickReply[]): QuickReply[] {
        const sorted = [...replies].sort((a, b) => {
            if (b.priority !== a.priority) {
                return b.priority - a.priority;
            }
            return a.text.length - b.text.length;
        });

        const result: QuickReply[] = [];
        const seenText = new Set<string>();
        const seenIntent = new Set<QuickReplyIntent>();

        for (const reply of sorted) {
            const textKey = reply.text.trim().toLowerCase();
            if (seenText.has(textKey)) continue;
            if (seenIntent.has(reply.intent)) continue;

            seenText.add(textKey);
            seenIntent.add(reply.intent);
            result.push(reply);
        }

        return result;
    }

    private getRecentQuickReplyHistory(input: ResponseAgentInput): {
        texts: Set<string>;
        intents: Set<QuickReplyIntent>;
    } {
        const rawHistory =
            input.metadata?.sessionContext?.quickRepliesHistory ??
            input.metadata?.quickRepliesHistory ??
            [];

        const history = [...rawHistory].sort(
            (left, right) => (right?.timestamp ?? 0) - (left?.timestamp ?? 0),
        );

        const texts = new Set<string>();
        for (const entry of history) {
            if (!entry?.text) continue;
            texts.add(String(entry.text).trim().toLowerCase());
        }

        const intents = new Set<QuickReplyIntent>();
        for (const entry of history.slice(
            0,
            RECENT_QUICK_REPLY_INTENTS_LIMIT,
        )) {
            const intent = entry?.intent;
            if (
                typeof intent === 'string' &&
                VALID_QUICK_REPLY_INTENT_SET.has(intent as QuickReplyIntent)
            ) {
                intents.add(intent as QuickReplyIntent);
            }
        }

        return { texts, intents };
    }

    private deduplicateByText(replies: QuickReply[]): QuickReply[] {
        const bestByText = new Map<string, QuickReply>();

        for (const reply of replies) {
            const textKey = reply.text.trim().toLowerCase();
            const existing = bestByText.get(textKey);
            if (
                !existing ||
                reply.priority > existing.priority ||
                (reply.priority === existing.priority &&
                    reply.text.length < existing.text.length)
            ) {
                bestByText.set(textKey, reply);
            }
        }

        return Array.from(bestByText.values());
    }

    private attachContextPayloads(
        replies: QuickReply[],
        aggregatedResults: AggregatedResults,
    ): QuickReply[] {
        const excludePropertyIds = Array.from(
            new Set(
                aggregatedResults.analysisResults
                    .flatMap((result) => result.propertyCards ?? [])
                    .map((card) => String(card.id ?? '').trim())
                    .filter(Boolean),
            ),
        );

        if (excludePropertyIds.length === 0) {
            return replies;
        }

        return replies.map((reply) => {
            if (
                reply.intent !== QUICK_REPLY_INTENT.CONTINUE_SEARCH &&
                reply.intent !== QUICK_REPLY_INTENT.EXPLORE_SIMILAR
            ) {
                return reply;
            }

            const currentPayload =
                reply.payload &&
                typeof reply.payload === 'object' &&
                !Array.isArray(reply.payload)
                    ? reply.payload
                    : {};

            return {
                ...reply,
                payload: {
                    ...currentPayload,
                    excludePropertyIds,
                },
            };
        });
    }

    private createQuickReply(
        text: string,
        intent: QuickReplyIntent,
        priority: number,
    ): QuickReply {
        return { text, intent, priority };
    }
}
