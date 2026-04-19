import { z } from 'zod';
import { AgentName, AgentPriority } from 'src/shared/agents';
import { AGENT_NAME, AGENT_PRIORITY } from '../../../../common/constants';

export const VALID_AGENT_NAMES: readonly AgentName[] =
    Object.values(AGENT_NAME);

export const VALID_PRIORITIES: readonly AgentPriority[] =
    Object.values(AGENT_PRIORITY);

const agentNames = Object.values(AGENT_NAME) as [string, ...string[]];
const priorities = Object.values(AGENT_PRIORITY) as [string, ...string[]];

export const coordinatorResponseSchema = z.object({
    agents: z
        .array(
            z.object({
                agent_name: z.enum(agentNames),
                priority: z.enum(priorities),
                tasks: z
                    .array(
                        z.object({
                            instruction: z.string(),
                            parameters: z
                                .object({})
                                .catchall(z.unknown())
                                .optional(),
                        }),
                    )
                    .min(1),
            }),
        )
        .min(1),
    shouldClarify: z.boolean().optional(),
    clarificationQuestions: z.array(z.string()).max(3).optional(),
    overallConfidence: z.number().min(0).max(1),
});
