import { Injectable } from '@nestjs/common';
import { SecretsConfig } from 'src/infrastructure/config';
import {
    AgentExecutionContext,
    BaseLLMAgent,
    buildLlmAgentConfig,
    ILLMAgentConfig,
    selectAgentModel,
} from 'src/shared/agents';
import { estimateTokens } from 'src/domain/ai/common/utils';
import type {
    ConversationSummary,
    PropertyPreferences,
} from 'src/domain/ai/common/types';
import type {
    SummarizationInput,
    SummarizationOutput,
} from './common/types/summarization.types';

@Injectable()
export class SummarizationAgentService extends BaseLLMAgent<
    SummarizationInput,
    SummarizationOutput,
    ILLMAgentConfig
> {
    constructor(private readonly secretsConfig: SecretsConfig) {
        super('SummarizationAgent');
    }

    protected loadConfiguration(): ILLMAgentConfig {
        return {
            name: 'SummarizationAgent',
            version: '1.0.0',
            enabled: true,
            llm: buildLlmAgentConfig(this.secretsConfig.ai.llm, {
                modelName: selectAgentModel(
                    this.secretsConfig.ai.models.summarization,
                ),
                temperature: 0.2,
                maxTokens: 1500,
                topP: 0.9,
                maxRetries: 3,
            }),
        };
    }

    protected getSystemPrompt(): string {
        return `Ты аналитик диалогов в системе продаж недвижимости. Создавай структурированное резюме в формате JSON.

ТРЕБОВАНИЯ:
- Извлекай ТОЛЬКО фактическую информацию из диалога
- Фокус: интересы клиента, упомянутые объекты, стадия сделки, контакты
- НЕ домысливай информацию
- Возвращай ТОЛЬКО валидный JSON без markdown

ФОРМАТ:
{
  "shortSummary": "контекст последних 3-5 сообщений (30-80 слов)",
  "longSummary": "подробное резюме с акцентом на намерениях клиента (100-200 слов)",
  "broadSummary": "постоянные факты о клиенте: имя, бюджет, тип жилья, предпочтения (до 150 слов)",
  "keyTopics": ["конкретные темы, не стоп-слова, макс 10"],
  "importantFacts": ["упомянутые объекты, цены, условия, контакты, макс 5"],
  "propertyPreferences": {
    "type": "квартира|студия|апартаменты|...",
    "bedrooms": 2,
    "budgetMin": 5000000,
    "budgetMax": 10000000,
    "areaMin": 40,
    "areaMax": 80,
    "floorMin": 3,
    "floorMax": 15,
    "building": "корпус А"
  },
  "rejections": ["что клиент явно отверг или не хочет"],
  "clientIntent": "основная цель клиента",
  "stage": "browsing|interested|ready_to_contact|negotiation"
}`;
    }

    protected async processInternal(
        input: SummarizationInput,
        context: AgentExecutionContext,
    ): Promise<SummarizationOutput> {
        const userPrompt = this.buildUserPrompt(
            input.conversationText,
            input.previousSummary,
        );
        const messages = this.buildMessages(userPrompt);
        const rawResponse = await this.invokeLLMWithRetry(messages, context);

        const parsed = this.parseJsonResponse<Record<string, unknown>>(
            rawResponse,
            { strict: false, fallbackValue: {} },
        );

        const summary = this.buildSummary(parsed);

        return {
            sessionId: input.sessionId,
            timestamp: new Date().toISOString(),
            success: true,
            metrics: this.createMetrics(context),
            summary,
        };
    }

    protected createErrorResponse(
        input: SummarizationInput,
        errorMessage: string,
        executionTime: number,
    ): SummarizationOutput {
        return {
            sessionId: input.sessionId,
            timestamp: new Date().toISOString(),
            success: false,
            metrics: {
                executionTime,
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
            },
            error: errorMessage,
            summary: this.emptyConversationSummary(),
        };
    }

    private buildUserPrompt(
        conversationText: string,
        previousSummary?: string,
    ): string {
        let prompt = '';
        if (previousSummary) {
            prompt += `КОНТЕКСТ (предыдущее резюме):\n${previousSummary}\n\n`;
        }
        prompt += `НОВАЯ ЧАСТЬ ДИАЛОГА:\n\n${conversationText}\n\n`;
        prompt += 'Проанализируй и верни JSON резюме.';
        return prompt;
    }

    private buildSummary(parsed: Record<string, unknown>): ConversationSummary {
        const shortSummary =
            typeof parsed.shortSummary === 'string' ? parsed.shortSummary : '';
        const longSummary =
            typeof parsed.longSummary === 'string' ? parsed.longSummary : '';
        const broadSummary =
            typeof parsed.broadSummary === 'string'
                ? parsed.broadSummary
                : undefined;
        const keyTopics = Array.isArray(parsed.keyTopics)
            ? (parsed.keyTopics as unknown[])
                  .filter((t): t is string => typeof t === 'string')
                  .slice(0, 10)
            : [];
        const importantFacts = Array.isArray(parsed.importantFacts)
            ? (parsed.importantFacts as unknown[])
                  .filter((f): f is string => typeof f === 'string')
                  .slice(0, 5)
            : [];
        const rejections = Array.isArray(parsed.rejections)
            ? (parsed.rejections as unknown[]).filter(
                  (r): r is string => typeof r === 'string',
              )
            : undefined;

        const propertyPreferences = this.buildPropertyPreferences(
            parsed.propertyPreferences,
        );

        const summaryTokens = estimateTokens(
            `${longSummary}\n${broadSummary ?? ''}\n${keyTopics.join(', ')}`,
        );

        const VALID_STAGES = [
            'browsing',
            'interested',
            'ready_to_contact',
            'negotiation',
        ] as const;
        const stage = VALID_STAGES.find((s) => s === parsed.stage);

        return {
            shortTermSummary: shortSummary,
            longTermSummary: longSummary,
            ...(broadSummary && { broadSummary }),
            keyTopics,
            importantFacts,
            ...(rejections?.length && { rejections }),
            ...(propertyPreferences && { propertyPreferences }),
            lastUpdated: Date.now(),
            tokens: summaryTokens,
            ...(stage && { stage }),
        };
    }

    private buildPropertyPreferences(
        raw: unknown,
    ): PropertyPreferences | undefined {
        if (!raw || typeof raw !== 'object') return undefined;
        const p = raw as Record<string, unknown>;
        const prefs: PropertyPreferences = {};
        if (typeof p.type === 'string') prefs.type = p.type;
        if (typeof p.bedrooms === 'number') prefs.bedrooms = p.bedrooms;
        if (typeof p.budgetMin === 'number') prefs.budgetMin = p.budgetMin;
        if (typeof p.budgetMax === 'number') prefs.budgetMax = p.budgetMax;
        if (typeof p.areaMin === 'number') prefs.areaMin = p.areaMin;
        if (typeof p.areaMax === 'number') prefs.areaMax = p.areaMax;
        if (typeof p.floorMin === 'number') prefs.floorMin = p.floorMin;
        if (typeof p.floorMax === 'number') prefs.floorMax = p.floorMax;
        if (typeof p.building === 'string') prefs.building = p.building;
        return Object.keys(prefs).length ? prefs : undefined;
    }

    private emptyConversationSummary(): ConversationSummary {
        return {
            shortTermSummary: '',
            longTermSummary: '',
            keyTopics: [],
            importantFacts: [],
            lastUpdated: Date.now(),
            tokens: 0,
        };
    }
}
