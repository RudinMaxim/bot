import { createHash } from 'node:crypto';

const {
    generateIntegrationApiKey,
    parseArgs,
} = require('../../scripts/generate-integration-api-key.cjs') as {
    generateIntegrationApiKey: (options: {
        name?: string;
        role?: string;
        bytes?: number;
    }) => {
        name: string;
        role: string;
        plainKey: string;
        sha256hex: string;
        envEntry: string;
        envVar: string;
        headerName: string;
    };
    parseArgs: (args: string[]) => {
        name?: string;
        role?: string;
        bytes: number;
        json: boolean;
        help: boolean;
    };
};

describe('generate-integration-api-key CLI', () => {
    it('parses CLI parameters', () => {
        expect(
            parseArgs(['--name', 'adm_1', '--role', 'admin', '--json']),
        ).toEqual({
            name: 'adm_1',
            role: 'admin',
            bytes: 32,
            json: true,
            help: false,
        });
    });

    it('generates a payload for a named admin key', () => {
        const payload = generateIntegrationApiKey({
            name: 'adm_1',
            role: 'admin',
            bytes: 32,
        });

        const expectedHash = createHash('sha256')
            .update(payload.plainKey, 'utf8')
            .digest('hex');

        expect(payload).toMatchObject({
            name: 'adm_1',
            role: 'admin',
            sha256hex: expectedHash,
            envEntry: `adm_1:${expectedHash}:admin`,
            envVar: `INTEGRATION_API_KEYS=adm_1:${expectedHash}:admin`,
            headerName: 'X-Api-Key',
        });
        expect(payload.plainKey).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('supports read-only role', () => {
        const payload = generateIntegrationApiKey({
            name: 'reader_1',
            role: 'read-only',
            bytes: 32,
        });

        expect(payload.role).toBe('read-only');
        expect(payload.envEntry).toMatch(/^reader_1:[0-9a-f]{64}:read-only$/);
    });

    it('rejects an unsupported role', () => {
        expect(() =>
            generateIntegrationApiKey({
                name: 'bad_1',
                role: 'root',
                bytes: 32,
            }),
        ).toThrow('role must be admin or read-only');
    });
});
