import * as path from 'path';

describe('resource-paths.util', () => {
    afterEach(() => {
        jest.resetModules();
        jest.dontMock('fs');
    });

    it('throws when the package root cannot be found', () => {
        jest.doMock('fs', () => ({
            existsSync: jest.fn(() => false),
        }));

        jest.isolateModules(() => {
            const { resourceRootPath } = require('../utils/resource-paths.util') as typeof import('../utils/resource-paths.util');

            expect(() => resourceRootPath()).toThrow(
                'Unable to locate package root for runtime assets',
            );
        });
    });

    it('caches the resolved resource root after the first lookup', () => {
        const serverRoot = path.resolve(__dirname, '../../../../../');
        const existsSync = jest.fn((candidate: string) => {
            return candidate === path.join(serverRoot, 'package.json');
        });

        jest.doMock('fs', () => ({
            existsSync,
        }));

        jest.isolateModules(() => {
            const { resourceRootPath } = require('../utils/resource-paths.util') as typeof import('../utils/resource-paths.util');

            const first = resourceRootPath();
            const callsAfterFirst = existsSync.mock.calls.length;
            const second = resourceRootPath();

            expect(second).toBe(first);
            expect(existsSync.mock.calls.length).toBe(callsAfterFirst);
            expect(first.replace(/\\/g, '/')).toMatch(/\/server\/resources$/);
        });
    });
});
