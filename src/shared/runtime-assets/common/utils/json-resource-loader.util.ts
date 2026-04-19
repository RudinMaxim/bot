import * as fs from 'fs/promises';
import * as path from 'path';

import type { RuntimeAssetLoadOptions } from '../types/runtime-asset.types';
import { resourceRootPath } from './resource-paths.util';

function isMissingFileError(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: unknown }).code === 'ENOENT'
    );
}

function isPathTraversalOutsideBaseDir(
    baseDir: string,
    filePath: string,
): boolean {
    const relativeToBaseDir = path.relative(baseDir, filePath);

    return (
        path.isAbsolute(relativeToBaseDir) ||
        relativeToBaseDir === '..' ||
        relativeToBaseDir.startsWith(`..${path.sep}`)
    );
}

export async function loadJsonResource<T>(
    relativePath: string,
    options: RuntimeAssetLoadOptions = {},
): Promise<T> {
    const baseDir = options.baseDir ?? resourceRootPath();
    const filePath = path.resolve(baseDir, relativePath);

    if (isPathTraversalOutsideBaseDir(baseDir, filePath)) {
        throw new Error(
            `Resource path escapes base directory: ${relativePath}`,
        );
    }

    let raw: string;
    try {
        raw = await fs.readFile(filePath, 'utf8');
    } catch (error) {
        if (isMissingFileError(error)) {
            throw new Error(`Resource asset not found: ${relativePath}`);
        }

        throw new Error(`Failed to read resource asset: ${relativePath}`);
    }

    try {
        return JSON.parse(raw) as T;
    } catch {
        throw new Error(`Invalid JSON in resource asset: ${relativePath}`);
    }
}
