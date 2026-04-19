import * as fs from 'fs';
import * as path from 'path';

const ENV_FILES = ['.env.local', '.env'];

const findNearestPackageRoot = (startDir: string): string => {
    let currentDir = startDir;

    while (true) {
        if (fs.existsSync(path.join(currentDir, 'package.json'))) {
            return currentDir;
        }

        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
            return startDir;
        }

        currentDir = parentDir;
    }
};

export const getEnvFilePaths = (): string[] => {
    const serverRoot = findNearestPackageRoot(__dirname);
    const repoRoot = path.dirname(serverRoot);

    return [
        ...ENV_FILES.map((file) => path.join(serverRoot, file)),
        ...ENV_FILES.map((file) => path.join(repoRoot, file)),
    ];
};
