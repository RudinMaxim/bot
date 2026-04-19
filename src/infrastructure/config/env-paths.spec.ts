import { getEnvFilePaths } from './env-paths';

describe('getEnvFilePaths', () => {
    it('includes server and repository env files in stable precedence order', () => {
        expect(getEnvFilePaths()).toEqual([
            expect.stringMatching(/[\\/]server[\\/]\.env\.local$/),
            expect.stringMatching(/[\\/]server[\\/]\.env$/),
            expect.stringMatching(/[\\/]developer-ai[\\/]\.env\.local$/),
            expect.stringMatching(/[\\/]developer-ai[\\/]\.env$/),
        ]);
    });
});
