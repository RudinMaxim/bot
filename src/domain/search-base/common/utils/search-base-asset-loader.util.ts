import * as path from 'path';

import { z } from 'zod';

import {
    loadJsonResource,
    resourceRootPath,
    type RuntimeAssetLoadOptions,
} from '../../../../shared/runtime-assets';
import type { SearchBaseAssetItem, SearchBaseAssetPayload } from '../types';

const searchBaseAssetStringSchema = z.string().trim().min(1);

const SEARCH_BASE_MAX_FOLLOW_UPS_PER_ITEM = 5;

const searchBaseAssetStepSchema = z
    .object({
        id: searchBaseAssetStringSchema,
        displayName: searchBaseAssetStringSchema,
        targetId: searchBaseAssetStringSchema,
    })
    .strict();

const searchBaseAssetItemSchema = z
    .object({
        id: searchBaseAssetStringSchema,
        category: searchBaseAssetStringSchema,
        title: searchBaseAssetStringSchema,
        queries: z.array(searchBaseAssetStringSchema).min(1),
        answer: searchBaseAssetStringSchema,
        guardrails: z.array(searchBaseAssetStringSchema).optional(),
        source: searchBaseAssetStringSchema,
        order: z.number().int().min(1),
        followUpStepIds: z
            .array(searchBaseAssetStringSchema)
            .max(SEARCH_BASE_MAX_FOLLOW_UPS_PER_ITEM)
            .optional(),
    })
    .strict();

const searchBaseAssetSchema = z
    .object({
        dataset: z.string().trim().min(1),
        locale: z.string().trim().min(1),
        version: z.number().int().min(1),
        steps: z.array(searchBaseAssetStepSchema),
        items: z.array(searchBaseAssetItemSchema),
    })
    .strict()
    .superRefine((payload, ctx) => {
        const seenItemIds = new Map<string, number>();

        payload.items.forEach((item, index) => {
            const previousIndex = seenItemIds.get(item.id);
            if (previousIndex !== undefined) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['items', index, 'id'],
                    message: `Duplicate item id "${item.id}"`,
                });
                return;
            }

            seenItemIds.set(item.id, index);
        });

        const seenStepIds = new Map<string, number>();
        payload.steps.forEach((step, index) => {
            const previousIndex = seenStepIds.get(step.id);
            if (previousIndex !== undefined) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['steps', index, 'id'],
                    message: `Duplicate step id "${step.id}"`,
                });
                return;
            }
            seenStepIds.set(step.id, index);
        });

        const knownItemIds = new Set(payload.items.map((item) => item.id));
        payload.steps.forEach((step, index) => {
            if (!knownItemIds.has(step.targetId)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['steps', index, 'targetId'],
                    message: `Unknown step targetId "${step.targetId}"`,
                });
            }
        });

        const knownStepIds = new Set(payload.steps.map((step) => step.id));
        payload.items.forEach((item, itemIndex) => {
            const stepIds = item.followUpStepIds;
            if (!stepIds?.length) return;

            const seenInItem = new Map<string, number>();
            stepIds.forEach((stepId, stepIndex) => {
                if (!knownStepIds.has(stepId)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: [
                            'items',
                            itemIndex,
                            'followUpStepIds',
                            stepIndex,
                        ],
                        message: `Unknown follow-up stepId "${stepId}"`,
                    });
                    return;
                }

                const previousIndex = seenInItem.get(stepId);
                if (previousIndex !== undefined) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: [
                            'items',
                            itemIndex,
                            'followUpStepIds',
                            stepIndex,
                        ],
                        message: `Duplicate follow-up stepId "${stepId}" within item "${item.id}"`,
                    });
                    return;
                }

                seenInItem.set(stepId, stepIndex);
            });
        });

        const stepById = new Map(payload.steps.map((step) => [step.id, step]));
        payload.items.forEach((item, itemIndex) => {
            const stepIds = item.followUpStepIds;
            if (!stepIds?.length) return;

            stepIds.forEach((stepId, stepIndex) => {
                const step = stepById.get(stepId);
                if (step && step.targetId === item.id) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: [
                            'items',
                            itemIndex,
                            'followUpStepIds',
                            stepIndex,
                        ],
                        message: `Follow-up step "${stepId}" targets its own item "${item.id}"`,
                    });
                }
            });
        });
    });

export function searchBaseAssetRootPath(): string {
    return path.resolve(resourceRootPath(), 'knowledge-base', 'search-base');
}

export function validateSearchBaseAsset(
    payload: unknown,
): SearchBaseAssetPayload {
    const result = searchBaseAssetSchema.safeParse(payload);
    if (result.success) {
        return result.data as SearchBaseAssetPayload;
    }

    const itemIssue = result.error.issues.find(isItemIssue);
    if (itemIssue) {
        throw new Error(
            `Invalid search-base asset item at ${formatIssuePath(itemIssue.path)}: ${formatIssueMessage(itemIssue)}`,
        );
    }

    const assetIssue = result.error.issues[0];
    if (assetIssue) {
        throw new Error(
            `Invalid search-base asset: ${formatIssueMessage(assetIssue)}`,
        );
    }

    throw new Error('Invalid search-base asset');
}

function isItemIssue(issue: z.ZodIssue): boolean {
    return issue.path[0] === 'items' && typeof issue.path[1] === 'number';
}

function formatIssuePath(pathSegments: (string | number)[]): string {
    if (pathSegments.length === 0) {
        return 'asset';
    }

    return pathSegments.reduce<string>((accumulator, segment, index) => {
        if (typeof segment === 'number') {
            return `${accumulator}[${segment}]`;
        }

        if (index === 0) {
            return segment;
        }

        return `${accumulator}.${segment}`;
    }, '');
}

function formatIssueMessage(issue: z.ZodIssue): string {
    if (
        issue.code === z.ZodIssueCode.unrecognized_keys &&
        'keys' in issue &&
        Array.isArray(issue.keys)
    ) {
        return `Unrecognized key${issue.keys.length === 1 ? '' : 's'}: ${issue.keys.map((key) => `"${key}"`).join(', ')}`;
    }

    return issue.message;
}

export async function loadSearchBaseAsset(
    relativePath: string,
    options: RuntimeAssetLoadOptions = {},
): Promise<SearchBaseAssetPayload> {
    const normalizedPath = relativePath.replace(/\\/g, '/');
    const payload = await loadJsonResource<unknown>(normalizedPath, {
        baseDir: options.baseDir ?? searchBaseAssetRootPath(),
    });

    return validateSearchBaseAsset(payload);
}

export function buildSearchBaseAssetItem(input: {
    id?: unknown;
    category?: unknown;
    title?: unknown;
    queries?: unknown;
    answer?: unknown;
    guardrails?: unknown;
    source?: unknown;
    order?: unknown;
    followUpStepIds?: unknown;
}): SearchBaseAssetItem | null {
    const result = searchBaseAssetItemSchema.safeParse(input);
    return result.success ? (result.data as SearchBaseAssetItem) : null;
}
