import * as path from 'path';

import { z } from 'zod';

import {
    loadJsonResource,
    resourceRootPath,
    type RuntimeAssetLoadOptions,
} from '../../../../shared/runtime-assets';
import type { SearchBaseAssetItem, SearchBaseAssetPayload } from '../types';

const searchBaseAssetStringSchema = z.string().trim().min(1);

const searchBaseAssetItemSchema = z
    .object({
        id: searchBaseAssetStringSchema,
        topic: searchBaseAssetStringSchema,
        intent: searchBaseAssetStringSchema,
        title: searchBaseAssetStringSchema,
        search_phrases: z.array(searchBaseAssetStringSchema).min(1),
        facts: z.array(searchBaseAssetStringSchema).min(1),
        answer: searchBaseAssetStringSchema,
        restrictions: z.array(searchBaseAssetStringSchema).optional(),
        tags: z.array(searchBaseAssetStringSchema).optional(),
        source: searchBaseAssetStringSchema,
        order: z.number().int().min(1),
    })
    .strict();

const searchBaseAssetSchema = z
    .object({
        dataset: z.string().trim().min(1),
        locale: z.string().trim().min(1),
        version: z.number().int().min(1),
        items: z.array(searchBaseAssetItemSchema),
    })
    .strict()
    .superRefine((payload, ctx) => {
        const seenIds = new Map<string, number>();

        payload.items.forEach((item, index) => {
            const previousIndex = seenIds.get(item.id);
            if (previousIndex !== undefined) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['items', index, 'id'],
                    message: `Duplicate item id "${item.id}"`,
                });
                return;
            }

            seenIds.set(item.id, index);
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
    topic?: unknown;
    intent?: unknown;
    title?: unknown;
    search_phrases?: unknown;
    facts?: unknown;
    answer?: unknown;
    restrictions?: unknown;
    tags?: unknown;
    source?: unknown;
    order?: unknown;
}): SearchBaseAssetItem | null {
    const result = searchBaseAssetItemSchema.safeParse(input);
    return result.success ? (result.data as SearchBaseAssetItem) : null;
}
