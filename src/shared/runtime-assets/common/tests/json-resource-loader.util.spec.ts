import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import {
    loadJsonResource,
} from '../utils/json-resource-loader.util';
import { resourceRootPath } from '../utils/resource-paths.util';

describe('json-resource-loader.util', () => {
    it('resolves the server resources root', () => {
        const root = resourceRootPath();

        expect(path.isAbsolute(root)).toBe(true);
        expect(path.basename(root)).toBe('resources');
        expect(path.basename(path.dirname(root))).toBe('server');
    });

    it('loads JSON from a relative resource path', async () => {
        const baseDir = await fs.mkdtemp(
            path.join(os.tmpdir(), 'runtime-assets-'),
        );

        try {
            const filePath = path.join(baseDir, 'fixtures', 'test.json');
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, '{"ok": true}', 'utf8');

            await expect(
                loadJsonResource<{ ok: boolean }>('fixtures/test.json', {
                    baseDir,
                }),
            ).resolves.toEqual({ ok: true });
        } finally {
            await fs.rm(baseDir, { recursive: true, force: true });
        }
    });

    it('throws a readable error when the resource is missing', async () => {
        const baseDir = await fs.mkdtemp(
            path.join(os.tmpdir(), 'runtime-assets-'),
        );

        try {
            await expect(
                loadJsonResource('fixtures/missing.json', {
                    baseDir,
                }),
            ).rejects.toThrow('Resource asset not found');
        } finally {
            await fs.rm(baseDir, { recursive: true, force: true });
        }
    });

    it('throws a readable error when the resource contains invalid JSON', async () => {
        const baseDir = await fs.mkdtemp(
            path.join(os.tmpdir(), 'runtime-assets-'),
        );

        try {
            const filePath = path.join(baseDir, 'fixtures', 'broken.json');
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, '{ not valid json', 'utf8');

            await expect(
                loadJsonResource('fixtures/broken.json', {
                    baseDir,
                }),
            ).rejects.toThrow('Invalid JSON in resource asset');
        } finally {
            await fs.rm(baseDir, { recursive: true, force: true });
        }
    });

    it('allows dot-prefixed in-base paths and rejects traversal outside the base directory', async () => {
        const parentDir = await fs.mkdtemp(
            path.join(os.tmpdir(), 'runtime-assets-parent-'),
        );
        const baseDir = path.join(parentDir, 'base');
        const hiddenDir = path.join(baseDir, '..hidden');
        const hiddenFile = path.join(hiddenDir, 'file.json');
        const escapedPath = path.join(parentDir, 'escape.json');

        try {
            await fs.mkdir(baseDir, { recursive: true });
            await fs.mkdir(hiddenDir, { recursive: true });
            await fs.writeFile(hiddenFile, '{"hidden": true}', 'utf8');
            await fs.writeFile(escapedPath, '{"escaped": true}', 'utf8');

            await expect(
                loadJsonResource('..hidden/file.json', {
                    baseDir,
                }),
            ).resolves.toEqual({ hidden: true });

            await expect(
                loadJsonResource('..\\escape.json', {
                    baseDir,
                }),
            ).rejects.toThrow('Resource path escapes base directory');

            await expect(
                loadJsonResource('../outside.json', {
                    baseDir,
                }),
            ).rejects.toThrow('Resource path escapes base directory');
        } finally {
            await fs.rm(parentDir, { recursive: true, force: true });
        }
    });

    it('rejects absolute Windows path inputs that escape the base directory', async () => {
        const baseDir = path.win32.resolve('C:\\runtime-assets', 'base');

        await expect(
            loadJsonResource('D:\\outside.json', {
                baseDir,
            }),
        ).rejects.toThrow('Resource path escapes base directory');
    });
});
