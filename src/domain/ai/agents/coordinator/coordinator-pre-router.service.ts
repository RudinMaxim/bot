import { Injectable, Logger } from '@nestjs/common';
import { AGENT_NAME, AGENT_PRIORITY } from '../../common/constants';
import type { AssignedAgent, AgentPriority } from 'src/shared/agents';

export interface CoordinatorPreRouteResult {
    matched: boolean;
    agents: AssignedAgent[];
    confidence: number;
    reason: string;
    shouldClarify?: boolean;
    clarificationQuestions?: string[];
}

const ACTION_PATTERNS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
    {
        pattern:
            /(запис(?:аться|ать|ите).{0,30}консультац|нужна консультац|хочу консультац|запишите меня)/i,
        label: 'consultation',
    },
    {
        pattern:
            /(обратн(?:ый|ого)\s+звон(?:ок|ка)|перезвоните|позвоните\s+мне|закаж(?:и|ите)\s+звонок)/i,
        label: 'callback',
    },
    { pattern: /связаться с менеджером/i, label: 'contact_manager' },
    {
        pattern:
            /(запис(?:ать|аться).*?(?:на\s+)?(?:экскурси|показ|просмотр)|book\s+tour)/i,
        label: 'book_tour',
    },
    { pattern: /забронировать\s+(лот|квартиру)/i, label: 'book_lot' },
];

const PROPERTY_SEARCH_RE =
    /(квартир|квартира|квартиру|таунхаус|коттедж|клубн(?:ый|ые)\s+дом|студи[яю]|однушк|двушк|тр[её]шк)/iu;
const BUDGET_RE =
    /((?:^|\s)(?:до|от)(?:\s|$)|бюджет|цена|стоимость|дороже|дешевле|млн|миллион|руб|₽)/iu;
const AREA_RE = /(площад|метр|м²|кв\.?\s*м)/iu;
const FLOOR_RE = /(этаж|этаже|этажа|floor)/iu;
const ROOMS_RE =
    /(комнат|одно|двух|тр[её]х|четыр[её]х|одна|две|три|четыре|1-?к|2-?к|3-?к|4-?к|однушк|двушк|тр[её]шк|спальн)/iu;
const SELECTION_VERB_RE =
    /(?:^|\s)(подбери|подберите|покажи|показать|найди|найдите|подбор|варианты|ищу|хочу|интересует|что\s+есть|есть\s+ли)(?:\s|$)/iu;
const BUILDING_RE = /(сибир(?:ь|и)?|волг(?:а|у|е)?)/iu;
const BROAD_PROPERTY_SELECTION_RE =
    /(?:покажи|показать|найди|найдите|подбери|подберите|что\s+есть(?:\s+из)?|есть\s+ли).{0,30}(?:все\s+)?(?:квартир(?:а|ы|у)?|коттедж(?:и)?|таунхаус(?:ы)?|студи[яю])/iu;
const STANDALONE_BUILDING_SWITCH_RE =
    /^(?!(?:а|и|но)\b)(?:(?:следующ(?:им|ая)\s+вопрос(?:ом)?\s+)?(?:давай\s+)?(?:теперь\s+)?(?:меняем(?:ся)?|покажи|показать|найди|подбери)\s+)?(?:на\s+|в\s+)?(?:волг(?:а|у|е)?|сибир(?:ь|и))\??$/iu;
const SITE_LOCALE_RE =
    /(локал(?:ь|и)|locale|regional settings?|region)(?:.*?(?:переключ|смени|change|switch|set))?|(?:переключ|смени|change|switch|set).*?(локал(?:ь|и)|locale|regional settings?|region)/iu;
const SITE_LANGUAGE_RE =
    /(?:(?:переключ|смени|change|switch|set).*(?:язык|language|english|russian|англий|русск))|(?:(?:язык|language).*(?:переключ|смени|change|switch|set))/iu;

const SITE_NAVIGATION_RE =
    /(перейд|открой|navigate|open|страниц|section|раздел|покажи\s+блок)/iu;
const SITE_SCROLL_RE = /(прокрут|scroll|долист|докрути)/iu;
const SITE_HIGHLIGHT_RE = /(подсвет|highlight|выдели)/iu;
const SITE_GO_BACK_RE = /(назад|go\s+back|вернись|вернуться)/iu;

const FAQ_RE =
    /(где\s+находи|адрес|как\s+добрать|парковк|инфраструктур|застройщик|mr\s*group|ход\s+строительств|сдач[аи]|срок|ипотек|рассрочк|материнск|маткапитал|trade[- ]?in|ремонт|отделк)/iu;
const FAC_KNOWLEDGE_RE =
    /(?:^|[^\p{L}\p{N}_])(фац|федеральн[\p{L}\p{N}_]*\s+аккредитационн[\p{L}\p{N}_]*\s+центр|аккредитац[\p{L}\p{N}_]*|масц|умц|learn\s*&?\s*training|повышени[\p{L}\p{N}_]*\s+квалификац[\p{L}\p{N}_]*|олимпиад[\p{L}\p{N}_]*|конкурс[\p{L}\p{N}_]*(?:\s+практическ[\p{L}\p{N}_]*\s+навык[\p{L}\p{N}_]*)?|профориентац[\p{L}\p{N}_]*|мероприят[\p{L}\p{N}_]*)(?=$|[^\p{L}\p{N}_])/iu;
const ASSISTANT_IDENTITY_RE =
    /(кто\s+ты|как\s+тебя\s+зовут|твое\s+имя|тво[её]\s+имя|что\s+ты\s+умеешь|чем\s+можешь\s+помочь|какие\s+у\s+тебя\s+возможности|who\s+are\s+you|what\s+is\s+your\s+name|what\s+can\s+you\s+do|how\s+can\s+you\s+help)/iu;

const CONTINUATION_RE =
    /^(а|и|но|ещ[её]|тогда|ок|хорошо|ладно|понятно|спасибо|да|нет)\b/iu;

const MIN_CONFIDENCE = 0.75;

@Injectable()
export class CoordinatorPreRouterService {
    private readonly logger = new Logger(CoordinatorPreRouterService.name);

    classify(input: string, sessionId: string): CoordinatorPreRouteResult {
        const trimmed = input.trim().toLowerCase();

        if (!trimmed || trimmed.length < 2) {
            return this.noMatch('input too short');
        }

        if (CONTINUATION_RE.test(trimmed) && trimmed.length < 30) {
            return this.noMatch('continuation signal');
        }

        const actionMatch = this.matchAction(trimmed);
        if (actionMatch) {
            this.logger.debug(
                `[${sessionId}] Pre-route: SEARCH (${actionMatch.label})`,
            );
            return {
                matched: true,
                agents: [
                    this.buildAgent(
                        AGENT_NAME.SEARCH,
                        AGENT_PRIORITY.HIGH,
                        input,
                    ),
                ],
                confidence: 0.9,
                reason: `search:${actionMatch.label}`,
            };
        }

        if (STANDALONE_BUILDING_SWITCH_RE.test(trimmed)) {
            this.logger.debug(
                `[${sessionId}] Pre-route: SEARCH (building_switch)`,
            );
            return {
                matched: true,
                agents: [
                    this.buildAgent(
                        AGENT_NAME.SEARCH,
                        AGENT_PRIORITY.HIGH,
                        input,
                    ),
                ],
                confidence: 0.85,
                reason: 'building_switch',
            };
        }

        const searchScore = this.scorePropertySearch(trimmed);
        if (searchScore >= MIN_CONFIDENCE) {
            this.logger.debug(
                `[${sessionId}] Pre-route: SEARCH (score=${searchScore.toFixed(2)})`,
            );
            return {
                matched: true,
                agents: [
                    this.buildAgent(
                        AGENT_NAME.SEARCH,
                        AGENT_PRIORITY.HIGH,
                        input,
                    ),
                ],
                confidence: searchScore,
                reason: 'property_search',
            };
        }

        if (this.isSiteNavigation(trimmed)) {
            this.logger.debug(
                `[${sessionId}] Pre-route: SEARCH (site_navigation)`,
            );
            return {
                matched: true,
                agents: [
                    this.buildAgent(
                        AGENT_NAME.SEARCH,
                        AGENT_PRIORITY.HIGH,
                        input,
                    ),
                ],
                confidence: 0.85,
                reason: 'site_navigation',
            };
        }

        if (FAC_KNOWLEDGE_RE.test(trimmed)) {
            this.logger.debug(
                `[${sessionId}] Pre-route: SEARCH (fac_knowledge)`,
            );
            return {
                matched: true,
                agents: [
                    this.buildAgent(
                        AGENT_NAME.SEARCH,
                        AGENT_PRIORITY.HIGH,
                        input,
                    ),
                ],
                confidence: 0.9,
                reason: 'fac_knowledge',
            };
        }

        if (ASSISTANT_IDENTITY_RE.test(trimmed)) {
            this.logger.debug(
                `[${sessionId}] Pre-route: ASSISTANT_PROFILE/SEARCH`,
            );
            return {
                matched: true,
                agents: [
                    this.buildAgent(
                        AGENT_NAME.SEARCH,
                        AGENT_PRIORITY.HIGH,
                        input,
                    ),
                ],
                confidence: 0.9,
                reason: 'assistant_profile',
            };
        }

        if (FAQ_RE.test(trimmed)) {
            this.logger.debug(`[${sessionId}] Pre-route: FAQ/SEARCH`);
            return {
                matched: true,
                agents: [
                    this.buildAgent(
                        AGENT_NAME.SEARCH,
                        AGENT_PRIORITY.HIGH,
                        input,
                    ),
                ],
                confidence: 0.8,
                reason: 'faq',
            };
        }

        return this.noMatch('no pattern match');
    }

    // ──────────────────────────────────────────
    // Private helpers
    // ──────────────────────────────────────────

    private matchAction(input: string): { label: string } | null {
        for (const { pattern, label } of ACTION_PATTERNS) {
            if (pattern.test(input)) {
                return { label };
            }
        }
        return null;
    }

    private scorePropertySearch(input: string): number {
        let score = 0;

        if (PROPERTY_SEARCH_RE.test(input)) score += 0.35;
        if (SELECTION_VERB_RE.test(input)) score += 0.25;
        if (BUDGET_RE.test(input)) score += 0.2;
        if (AREA_RE.test(input)) score += 0.15;
        if (FLOOR_RE.test(input)) score += 0.1;
        if (ROOMS_RE.test(input)) score += 0.15;
        if (BUILDING_RE.test(input)) score += 0.15;
        if (BROAD_PROPERTY_SELECTION_RE.test(input)) score += 0.2;
        if (
            !CONTINUATION_RE.test(input) &&
            BUILDING_RE.test(input) &&
            (PROPERTY_SEARCH_RE.test(input) || ROOMS_RE.test(input))
        ) {
            score += 0.2;
        }

        return Math.min(score, 1);
    }

    private isSiteNavigation(input: string): boolean {
        return (
            SITE_LOCALE_RE.test(input) ||
            SITE_LANGUAGE_RE.test(input) ||
            SITE_NAVIGATION_RE.test(input) ||
            SITE_SCROLL_RE.test(input) ||
            SITE_HIGHLIGHT_RE.test(input) ||
            SITE_GO_BACK_RE.test(input)
        );
    }

    private buildAgent(
        agentName: string,
        priority: AgentPriority,
        instruction: string,
    ): AssignedAgent {
        return {
            agent_name: agentName as AssignedAgent['agent_name'],
            priority,
            tasks: [{ instruction }],
        };
    }

    private noMatch(reason: string): CoordinatorPreRouteResult {
        return {
            matched: false,
            agents: [],
            confidence: 0,
            reason,
        };
    }
}
