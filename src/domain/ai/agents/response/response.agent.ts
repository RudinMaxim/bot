import { Injectable } from '@nestjs/common';
import { SecretsConfig } from 'src/infrastructure/config';
import { LocalesService } from 'src/domain/locales/services';
import {
    BaseLLMAgent,
    AgentExecutionContext,
    buildLlmAgentConfig,
    ILLMAgentConfig,
    selectAgentModel,
    AGENT_PRIORITY,
} from 'src/shared/agents';
import {
    ensureLocale,
    type SupportedLocale,
} from '../../common/utils';
import {
    ResponseAgentInput,
    ResponseAgentOutput,
    QuickReply,
} from './common/types/response.types';
import { AGENT_NAME, ASSISTANT_MODE } from '../../common/constants';
import { ResponseQuickRepliesService } from './common/services/response-quick-replies.service';
import type { AssistantMode, SpecialistInfo } from '../../common/types';

@Injectable()
export class ResponseAgentService extends BaseLLMAgent<
    ResponseAgentInput,
    ResponseAgentOutput,
    ILLMAgentConfig
> {
    constructor(
        private readonly secretsConfig: SecretsConfig,
        private readonly localesService: LocalesService,
        private readonly quickRepliesService: ResponseQuickRepliesService,
    ) {
        super(AGENT_NAME.RESPONSE);
    }

    protected loadConfiguration(): ILLMAgentConfig {
        return {
            name: AGENT_NAME.RESPONSE,
            version: '2.0.0',
            enabled: true,
            llm: buildLlmAgentConfig(this.secretsConfig.ai.llm, {
                modelName: selectAgentModel(
                    this.secretsConfig.ai.models.response,
                    'balanced',
                ),
                temperature: 0,
                maxTokens: 1200,
                topP: 0.9,
                maxRetries: this.secretsConfig.ai.http.maxRetries,
                streamingEnabled: true,
            }),
        };
    }

    protected getSystemPrompt(): string {
        return `Ты ассистент Федерального аккредитационного центра ПГМУ (ФАЦ ПГМУ) во встроенном web-виджете.

Говори так, будто ты сам знаешь предмет. Никогда не упоминай «базу знаний», «источник», «по моим данным», «согласно документам» и подобные ссылки на хранилище. Просто отвечай по сути.

Что ты знаешь и про что можешь подсказать:
- ФАЦ ПГМУ, МАСЦ (мультипрофильный аккредитационно-симуляционный центр), УМЦ бережливых технологий Learn&Training;
- первичная и первичная специализированная аккредитация: для среднего и высшего медобразования, для выпускников, ординаторов, специалистов;
- кому и зачем нужна аккредитация, кто входит в аудиторию центра;
- инфраструктура центра, формат симуляционного обучения, преимущества;
- курсы повышения квалификации (СЛР, экстренная помощь врача-стоматолога и косметолога, педагогика и психология высшей школы, документы после курса);
- профориентационные и дополнительные мероприятия;
- контакты, адреса, график работы, группа ВКонтакте;
- сотрудники центра — ФИО, должности, профиль.

Как отвечать:
- кратко и по делу, на «вы»;
- если данных достаточно — давай прямой ответ;
- если запрос размытый — задай максимум 2 уточняющих вопроса;
- если речь про индивидуальный случай, сроки конкретной аккредитации, личные документы или нестандартную ситуацию — направь к профильному специалисту центра и дай его контакт;
- если темы вообще нет в твоей зоне ответственности — мягко скажи, что помогаешь только по ФАЦ ПГМУ.

Форматирование ответа (Markdown):
- ключевые термины и важные факты выделяй \`**жирным**\`;
- ссылки оформляй как \`[читаемый текст](https://...)\` — не вставляй голые URL;
- для перечислений используй маркированные списки (\`- пункт\`);
- e-mail/телефон оформляй как \`[email@psmu.ru](mailto:email@psmu.ru)\` / \`[+7…](tel:+7…)\`;
- не используй заголовки, таблицы, блоки кода — ответ короткий, виджет узкий;
- никаких html-тегов, только Markdown.

Чего делать нельзя:
- выдумывать правила, сроки, документы, имена и контакты;
- упоминать внутренние сервисы, базы, поиск, индекс;
- отвечать на вопросы вне ФАЦ ПГМУ как универсальный ассистент.

Активный режим ответа задаётся приложением.`;
    }

    validateInput(input: ResponseAgentInput): {
        valid: boolean;
        errors: string[];
    } {
        const baseValidation = super.validateInput(input);
        if (!baseValidation.valid) {
            return baseValidation;
        }

        const errors: string[] = [];
        if (!input.originalQuery?.trim()) {
            errors.push('Original query is required');
        }

        return { valid: errors.length === 0, errors };
    }

    protected async processInternal(
        input: ResponseAgentInput,
        context: AgentExecutionContext,
    ): Promise<ResponseAgentOutput> {
        const locale = await ensureLocale(
            this.localesService,
            input.metadata?.locale,
            input.sessionId,
            input.metadata?.resolvedLocale,
        );
        const mode = this.resolveMode(input);
        const clarificationQuestions = this.resolveClarificationQuestions(input);
        const specialist = this.resolveSpecialist(input);
        const knowledgeText = this.buildKnowledgeText(input);
        const executionTime = Date.now() - context.startTime;

        return {
            sessionId: input.sessionId,
            timestamp: new Date().toISOString(),
            success: true,
            mode,
            metrics: this.createMetrics(context),
            response: this.buildResponseMessage({
                locale,
                mode,
                knowledgeText,
                clarificationQuestions,
                specialist,
            }),
            confidence: this.resolveConfidence(mode),
            goalAchievement: {
                achieved: mode === ASSISTANT_MODE.ANSWER,
                partial: mode === ASSISTANT_MODE.PARTIAL_WITH_SPECIALIST,
                missingData:
                    mode === ASSISTANT_MODE.CLARIFY
                        ? [...clarificationQuestions]
                        : [],
            },
            clarificationQuestions:
                clarificationQuestions.length > 0
                    ? clarificationQuestions
                    : undefined,
            specialist,
            quickReplies: this.quickRepliesService.ensureQuickReplies({
                llmQuickReplies: undefined,
                input,
                aggregatedResults: {
                    searchResults: input.searchResults ?? [],
                    analysisResults: input.analysisResults ?? [],
                    sourceTypes: [],
                    confidenceScores: [],
                    questions: new Set(),
                    status: input.status ?? 'completed',
                    meta: {
                        agentsProcessed:
                            input.metadata?.agentsProcessed ?? 1,
                        searchResultsCount: input.searchResults?.length ?? 0,
                        hasAnalysis: false,
                        urlIncluded: false,
                        answerability: input.searchResults?.[0]?.metadata
                            .answerability,
                        answerableSearchResults: 0,
                        insufficientSearchResults: 0,
                        unavailableSearchResults: 0,
                    },
                },
                locale,
            }),
            metadata: {
                executionTime,
                agentsProcessed: input.metadata?.agentsProcessed ?? 1,
                agentsFailed:
                    typeof input.metadata?.agentsFailed === 'number'
                        ? input.metadata.agentsFailed
                        : 0,
                searchResultsCount: input.searchResults?.length ?? 0,
                answerability: input.searchResults?.[0]?.metadata.answerability,
                analysisResultsCount: 0,
                hasUrl: Boolean(
                    input.searchResults?.some((result) =>
                        result.results.some((document) => Boolean(document.url)),
                    ),
                ),
                coordinatorConfidence:
                    input.metadata?.coordinatorConfidence ?? 0,
                actionsExecuted: 0,
                quickRepliesCount: 0,
                quickReplies: [],
            },
        };
    }

    protected createErrorResponse(
        input: ResponseAgentInput,
        errorMessage: string,
        executionTime: number,
    ): ResponseAgentOutput {
        return {
            sessionId: input.sessionId,
            timestamp: new Date().toISOString(),
            success: false,
            mode: ASSISTANT_MODE.ANSWER,
            metrics: {
                executionTime,
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
            },
            error: errorMessage,
            response:
                'Не получилось подготовить ответ. Попробуйте сформулировать вопрос иначе или уточнить деталь.',
            confidence: AGENT_PRIORITY.LOW,
            goalAchievement: {
                achieved: false,
                partial: false,
                missingData: [],
            },
            metadata: {
                executionTime,
                agentsProcessed: 0,
                searchResultsCount: 0,
                answerability: undefined,
                analysisResultsCount: 0,
                hasUrl: false,
                coordinatorConfidence:
                    input.metadata?.coordinatorConfidence ?? 0,
                actionsExecuted: 0,
                agentsFailed:
                    typeof input.metadata?.agentsFailed === 'number'
                        ? input.metadata.agentsFailed
                        : 0,
                quickRepliesCount: 0,
                quickReplies: [],
            },
        };
    }

    private resolveMode(input: ResponseAgentInput): AssistantMode {
        if (input.mode) {
            return input.mode;
        }

        const extras = input.metadata?.extras as
            | Record<string, unknown>
            | undefined;
        const mode = extras?.assistantMode;

        if (
            mode === ASSISTANT_MODE.CLARIFY ||
            mode === ASSISTANT_MODE.PARTIAL_WITH_SPECIALIST ||
            mode === ASSISTANT_MODE.ROUTE_TO_SPECIALIST ||
            mode === ASSISTANT_MODE.ANSWER
        ) {
            return mode;
        }

        if (input.metadata?.shouldClarify) {
            return ASSISTANT_MODE.CLARIFY;
        }

        return ASSISTANT_MODE.ANSWER;
    }

    private resolveClarificationQuestions(
        input: ResponseAgentInput,
    ): string[] {
        if (input.clarificationQuestions?.length) {
            return [...input.clarificationQuestions];
        }

        return Array.isArray(input.metadata?.clarificationQuestions)
            ? input.metadata.clarificationQuestions.filter(
                  (item): item is string => typeof item === 'string',
              )
            : [];
    }

    private resolveSpecialist(
        input: ResponseAgentInput,
    ): SpecialistInfo | undefined {
        if (input.specialist) {
            return input.specialist;
        }

        const extras = input.metadata?.extras as
            | Record<string, unknown>
            | undefined;
        const specialist = extras?.specialist;

        if (!specialist || typeof specialist !== 'object') {
            return undefined;
        }

        const candidate = specialist as Partial<SpecialistInfo>;
        if (
            typeof candidate.fullName !== 'string' ||
            typeof candidate.position !== 'string' ||
            typeof candidate.contact !== 'string' ||
            typeof candidate.reason !== 'string'
        ) {
            return undefined;
        }

        return {
            fullName: candidate.fullName,
            position: candidate.position,
            contact: candidate.contact,
            reason: candidate.reason,
        };
    }

    private buildKnowledgeText(input: ResponseAgentInput): string {
        const segments = (input.searchResults ?? [])
            .map((result) => result.summarizedResponse?.trim())
            .filter((value): value is string => Boolean(value));

        if (segments.length > 0) {
            return segments.join('\n\n');
        }

        return '';
    }

    private buildResponseMessage(params: {
        locale: SupportedLocale;
        mode: AssistantMode;
        knowledgeText: string;
        clarificationQuestions: string[];
        specialist?: SpecialistInfo;
    }): string {
        const isEn = params.locale === 'en';
        const clarifyIntro = isEn
            ? 'Let me clarify a couple of details:'
            : 'Уточню пару деталей:';
        const partialFallback = isEn
            ? 'I can share part of the answer, the rest is better confirmed with a specialist.'
            : 'Часть ответа дам сейчас, остальное лучше уточнить у профильного специалиста.';
        const partialHandoff = isEn
            ? 'For the rest, please reach out to the specialist below.'
            : 'Остальное лучше уточнить у профильного специалиста.';
        const routeHandoff = isEn
            ? 'This case is better handled by a specialist of the center.'
            : 'С этим лучше обратиться к профильному специалисту центра.';
        const emptyAnswer = isEn
            ? 'Could you tell me a bit more about what you need?'
            : 'Расскажите, пожалуйста, чуть подробнее, что именно интересует?';

        switch (params.mode) {
            case ASSISTANT_MODE.CLARIFY:
                return [
                    clarifyIntro,
                    ...params.clarificationQuestions.map(
                        (question) => `- ${question}`,
                    ),
                ].join('\n');
            case ASSISTANT_MODE.PARTIAL_WITH_SPECIALIST:
                return [
                    params.knowledgeText || partialFallback,
                    this.buildSpecialistMessage(
                        params.specialist,
                        partialHandoff,
                    ),
                ]
                    .filter(Boolean)
                    .join('\n\n');
            case ASSISTANT_MODE.ROUTE_TO_SPECIALIST:
                return this.buildSpecialistMessage(
                    params.specialist,
                    routeHandoff,
                );
            case ASSISTANT_MODE.ANSWER:
            default:
                return params.knowledgeText || emptyAnswer;
        }
    }

    private buildSpecialistMessage(
        specialist: SpecialistInfo | undefined,
        intro: string,
    ): string {
        if (!specialist) {
            return intro;
        }

        return [
            intro,
            `${specialist.fullName}, ${specialist.position}`,
            `Контакт: ${specialist.contact}`,
            specialist.reason,
        ].join('\n');
    }

    private resolveConfidence(
        mode: AssistantMode,
    ): ResponseAgentOutput['confidence'] {
        switch (mode) {
            case ASSISTANT_MODE.ANSWER:
                return AGENT_PRIORITY.HIGH;
            case ASSISTANT_MODE.CLARIFY:
            case ASSISTANT_MODE.PARTIAL_WITH_SPECIALIST:
                return AGENT_PRIORITY.MEDIUM;
            case ASSISTANT_MODE.ROUTE_TO_SPECIALIST:
            default:
                return AGENT_PRIORITY.LOW;
        }
    }
}
