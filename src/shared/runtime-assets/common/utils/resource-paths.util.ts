import * as fs from 'fs';
import * as path from 'path';

let cachedResourceRootPath: string | undefined;

function findNearestPackageRoot(startDir: string): string {
    let currentDir = startDir;

    while (true) {
        if (fs.existsSync(path.join(currentDir, 'package.json'))) {
            return currentDir;
        }

        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
            throw new Error(
                'Unable to locate package root for runtime assets',
            );
        }

        currentDir = parentDir;
    }
}

export function resourceRootPath(): string {
    if (!cachedResourceRootPath) {
        cachedResourceRootPath = path.resolve(
            findNearestPackageRoot(__dirname),
            'resources',
        );
    }

    return cachedResourceRootPath;
}
