import { Injectable } from '@nestjs/common';
import { SecretsConfig } from 'src/infrastructure/config';
import {
    AgentExecutionContext,
    BaseLLMAgent,
    ILLMAgentConfig,
    TextUtils,
    ValidationUtils,
    AssignedAgent,
    AgentTask,
    buildLlmAgentConfig,
    selectAgentModel,
} from 'src/shared/agents';
import {
    CoordinatorInput,
    CoordinatorResponse,
    ParsedCoordinatorLLMResponse,
} from './common/types/coordinator.types';
import {
    AGENT_NAME,
    AGENT_PRIORITY,
    ASSISTANT_MODE,
    CONFIDENCE,
} from '../../common/constants';
import { CoordinatorPreRouterService } from './coordinator-pre-router.service';

export type CoordinatorAgentConfig = ILLMAgentConfig;

@Injectable()
export class CoordinatorAgentService extends BaseLLMAgent<
    CoordinatorInput,
    CoordinatorResponse,
    CoordinatorAgentConfig
> {
    constructor(
        private readonly secretsConfig: SecretsConfig,
        private readonly preRouter: CoordinatorPreRouterService,
    ) {
        super('CoordinatorAgent');
    }
    protected loadConfiguration(): CoordinatorAgentConfig {
        const modelName = selectAgentModel(
            this.secretsConfig.ai.models.coordinator,
        );
        const maxRetries = this.secretsConfig.ai.http.maxRetries;

        return {
            name: AGENT_NAME.COORDINATOR,
            version: '1.0.0',
            enabled: true,
            llm: buildLlmAgentConfig(this.secretsConfig.ai.llm, {
                modelName,
                temperature: 0,
                maxTokens: 500,
                topP: 0.9,
                maxRetries,
            }),
        };
    }

    protected getSystemPrompt(): string {
        return `Ты маршрутизатор MAX для вопросов по аккредитации.

Разрешено только 4 режима:
- ${ASSISTANT_MODE.ANSWER}
- ${ASSISTANT_MODE.CLARIFY}
- ${ASSISTANT_MODE.PARTIAL_WITH_SPECIALIST}
- ${ASSISTANT_MODE.ROUTE_TO_SPECIALIST}

Правила:
- не выдумывай факты, сроки, документы и контакты;
- если запрос размытый или короткий, выбери режим ${ASSISTANT_MODE.CLARIFY} и задай максимум 2 коротких вопроса;
- если вопрос можно закрыть через базу знаний, выбери ${ASSISTANT_MODE.ANSWER};
- если ответа в базе знаний не хватит или есть высокий риск ошибки, выбери ${ASSISTANT_MODE.ROUTE_TO_SPECIALIST};
- ${ASSISTANT_MODE.PARTIAL_WITH_SPECIALIST} используй только когда уместно дать проверенную часть ответа и затем направить к специалисту;
- отвечай только JSON.
`;
    }

    validateInput(input: CoordinatorInput) {
        const errors: string[] = [];

        errors.push(...ValidationUtils.validateSessionId(input.sessionId));
        errors.push(...ValidationUtils.validateTimestamp(input.timestamp));

        if (ValidationUtils.isEmptyString(input.input)) {
            errors.push('Input text is required and cannot be empty');
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    protected async processInternal(
        input: CoordinatorInput,
        context: AgentExecutionContext,
    ): Promise<CoordinatorResponse> {
        const preRoute = this.preRouter.classify(input.input, input.sessionId);
        if (preRoute.matched) {
            this.logger.log(
                `[${input.sessionId}] Pre-routed: ${preRoute.reason} (confidence=${preRoute.confidence.toFixed(2)})`,
            );
            return {
                success: true,
                sessionId: input.sessionId,
                input: input.input,
                timestamp: input.timestamp,
                mode: preRoute.shouldClarify
                    ? ASSISTANT_MODE.CLARIFY
                    : ASSISTANT_MODE.ANSWER,
                agents: preRoute.agents,
                shouldClarify: preRoute.shouldClarify,
                clarificationQuestions: preRoute.clarificationQuestions ?? [],
                routingReason: undefined,
                overallConfidence: preRoute.confidence,
                metrics: this.createMetrics(context),
            };
        }

        const promptText = this.buildPromptWithContext(input);
        const messages = this.buildMessages(promptText);
        const rawResponse = await this.invokeLLMWithRetry(messages, context);
        const parsed = this.parseJsonResponse<unknown>(rawResponse, {
            strict: false,
            fallbackValue: {},
        });

        return this.parseCoordinatorResponse(parsed, input, context);
    }

    protected createErrorResponse(
        input: CoordinatorInput,
        errorMessage: string,
        executionTime: number,
    ): CoordinatorResponse {
        this.logger.warn(
            `[${input.sessionId}] Using fallback response with search_agent due to error: ${errorMessage}`,
        );

        return {
            success: false,
            sessionId: input.sessionId,
            input: input.input,
            timestamp: input.timestamp,
            mode: ASSISTANT_MODE.ANSWER,
            agents: [
                {
                    agent_name: AGENT_NAME.SEARCH,
                    priority: AGENT_PRIORITY.MEDIUM,
                    tasks: [
                        {
                            instruction: `Process user input: ${input.input.substring(0, 100)}`,
                            parameters: {
                                fallback: true,
                                original_input: input.input,
                                error_recovery: true,
                                query: input.input,
                            },
                        },
                    ],
                },
            ],
            shouldClarify: false,
            clarificationQuestions: [],
            routingReason: undefined,
            overallConfidence: 0.3,
            metrics: {
                executionTime,
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
            },
        };
    }

    private buildPromptWithContext(input: CoordinatorInput): string {
        const escapedInput = TextUtils.escapeForJson(input.input);
        const contextInfo = this.extractStructuredContext(input);

        let promptText = `ТЕКУЩИЙ ЗАПРОС: "${escapedInput}"\n\n`;

        if (contextInfo.hasContext) {
            promptText += `КОНТЕКСТ СЕССИИ:\n`;

            if (contextInfo.clientInfo) {
                promptText += `Клиент: ${contextInfo.clientInfo}\n`;
            }

            if (contextInfo.conversationSummary) {
                promptText += `История: ${contextInfo.conversationSummary}\n`;
            }

            if (contextInfo.recentMessages.length > 0) {
                promptText += `Последние сообщения:\n`;
                contextInfo.recentMessages.forEach((msg) => {
                    promptText += `- ${msg}\n`;
                });
            }

            if (contextInfo.previousResults) {
                promptText += `Предыдущий результат: confidence=${contextInfo.previousResults.confidence}, `;
                promptText += `agents=${contextInfo.previousResults.agentsUsed || 0}, `;
            }

            promptText += `\n`;
        }

        promptText += `ОТВЕТ (только JSON):
{
  "mode": "answer|clarify|partial_with_specialist|route_to_specialist",
  "sessionId": "${input.sessionId}",
  "input": "${escapedInput}",
  "timestamp": "${input.timestamp}",
  "agents": [{
    "agent_name": "action_agent|search_agent|apartment_selection_agent|site_assistant_agent",
    "priority": "high|medium|low",
    "tasks": [{
      "instruction": "текстовое описание задачи с учетом контекста (до 150 символов)",
    }]
  }],
  "shouldClarify": true|false,
  "clarificationQuestions": ["вопрос для уточнения1", "вопрос2"],
  "routingReason": "короткое объяснение, зачем нужен специалист",
  "overallConfidence": 0.8
}`;

        return promptText;
    }

    private extractStructuredContext(input: CoordinatorInput): {
        hasContext: boolean;
        clientInfo?: string;
        conversationSummary?: string;
        recentMessages: string[];
        previousResults?: {
            confidence: string;
            agentsUsed?: number;
        };
    } {
        const result: {
            hasContext: boolean;
            clientInfo?: string;
            conversationSummary?: string;
            recentMessages: string[];
            previousResults?: {
                confidence: string;
                agentsUsed?: number;
            };
        } = {
            hasContext: false,
            recentMessages: [],
        };

        const metadata = input.metadata;
        if (!metadata) return result;

        if (metadata.sessionContext?.summary?.shortTermSummary) {
            result.conversationSummary =
                metadata.sessionContext.summary.shortTermSummary.substring(
                    0,
                    200,
                );
            result.hasContext = true;
        }

        if (Array.isArray(metadata.sessionContext?.messageHistory)) {
            const recentMessages = (
                metadata.sessionContext.messageHistory as Array<{
                    role?: string;
                    content?: unknown;
                }>
            )
                .slice(-3)
                .map((msg) => {
                    const role = msg?.role === 'user' ? 'Клиент' : 'Ассистент';
                    const contentRaw = msg?.content;
                    const content = TextUtils.truncate(
                        typeof contentRaw === 'string'
                            ? contentRaw
                            : JSON.stringify(contentRaw ?? ''),
                        80,
                    );
                    return `${role}: ${content}`;
                });

            if (recentMessages.length > 0) {
                result.recentMessages = recentMessages;
                result.hasContext = true;
            }
        }

        if (metadata.previousResults) {
            const prev = metadata.previousResults;
            result.previousResults = {
                confidence:
                    typeof prev.confidence === 'string'
                        ? prev.confidence
                        : JSON.stringify(prev.confidence ?? 'unknown'),
                agentsUsed:
                    typeof prev.agentsUsed === 'number' &&
                    Number.isFinite(prev.agentsUsed)
                        ? prev.agentsUsed
                        : undefined,
            };
            result.hasContext = true;
        }

        return result;
    }

    private parseCoordinatorResponse(
        parsed: unknown,
        originalInput: CoordinatorInput,
        context: AgentExecutionContext,
    ): CoordinatorResponse {
        const data =
            parsed && typeof parsed === 'object'
                ? (parsed as Partial<ParsedCoordinatorLLMResponse>)
                : {};

        const mappedAgents = Array.isArray(data.agents)
            ? data.agents
                  .map((agent) => {
                      const tasks = Array.isArray(agent?.tasks)
                          ? agent.tasks
                                .map((task) => {
                                    const instruction =
                                        typeof task?.instruction === 'string'
                                            ? task.instruction
                                            : '';
                                    if (!instruction.trim()) {
                                        return null;
                                    }
                                    return {
                                        instruction: TextUtils.truncate(
                                            instruction,
                                            500,
                                        ),
                                        parameters:
                                            task?.parameters &&
                                            typeof task.parameters === 'object'
                                                ? task.parameters
                                                : {},
                                    } as AgentTask;
                                })
                                .filter((task): task is AgentTask =>
                                    Boolean(task),
                                )
                          : [];

                      if (!tasks.length) {
                          return null;
                      }

                      const agentName =
                          typeof agent?.agent_name === 'string' &&
                          agent.agent_name.trim().length > 0
                              ? agent.agent_name
                              : AGENT_NAME.SEARCH;

                      const priority =
                          typeof agent?.priority === 'string' &&
                          agent.priority.trim().length > 0
                              ? agent.priority
                              : AGENT_PRIORITY.MEDIUM;

                      return {
                          agent_name: agentName,
                          priority,
                          tasks,
                      } as AssignedAgent;
                  })
                  .filter((agent): agent is AssignedAgent => Boolean(agent))
            : [];

        const overallConfidence =
            typeof data.overallConfidence === 'number' &&
            Number.isFinite(data.overallConfidence)
                ? Math.max(0, Math.min(1, data.overallConfidence))
                : CONFIDENCE.FAILED;
        const clarificationQuestions = Array.isArray(
            data.clarificationQuestions,
        )
            ? data.clarificationQuestions
                  .filter((item): item is string => typeof item === 'string')
                  .map((item) => item.trim())
                  .filter((item) => item.length > 0)
                  .slice(0, 3)
            : [];
        const fallbackClarificationQuestions =
            clarificationQuestions.length > 0
                ? []
                : this.buildSelectionClarificationQuestions(
                      originalInput.input,
                      mappedAgents,
                  );
        const finalClarificationQuestions =
            clarificationQuestions.length > 0
                ? clarificationQuestions
                : fallbackClarificationQuestions;

        const response: CoordinatorResponse = {
            success: true,
            sessionId: originalInput.sessionId,
            input: originalInput.input,
            timestamp: originalInput.timestamp,
            mode: this.normalizeMode(data.mode),
            agents: mappedAgents,
            shouldClarify: Boolean(data.shouldClarify),
            clarificationQuestions: finalClarificationQuestions,
            routingReason:
                typeof data.routingReason === 'string' &&
                data.routingReason.trim().length > 0
                    ? data.routingReason.trim()
                    : undefined,
            overallConfidence,
            metrics: this.createMetrics(context),
        };

        this.logger.log(
            `[${originalInput.sessionId}] Successfully assigned ${response.agents.length} agents: ` +
                `${response.agents.map((a) => JSON.stringify(a.agent_name)).join(', ')}`,
        );

        return response;
    }

    private normalizeMode(value: unknown): CoordinatorResponse['mode'] {
        switch (value) {
            case ASSISTANT_MODE.CLARIFY:
                return ASSISTANT_MODE.CLARIFY;
            case ASSISTANT_MODE.PARTIAL_WITH_SPECIALIST:
                return ASSISTANT_MODE.PARTIAL_WITH_SPECIALIST;
            case ASSISTANT_MODE.ROUTE_TO_SPECIALIST:
                return ASSISTANT_MODE.ROUTE_TO_SPECIALIST;
            case ASSISTANT_MODE.ANSWER:
            default:
                return ASSISTANT_MODE.ANSWER;
        }
    }

    private buildSelectionClarificationQuestions(
        input: string,
        _agents: ReadonlyArray<AssignedAgent>,
    ): string[] {
        const normalized = input.trim().toLowerCase();
        if (!normalized) {
            return ['Что именно вы хотите уточнить по аккредитации?'];
        }

        if (normalized.length <= 3) {
            return ['Что именно вам нужно по аккредитации?'];
        }

        return [];
    }
}
