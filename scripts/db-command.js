const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const nodeModulesDir = path.join(rootDir, 'node_modules');
const typeormCliPath = path.join(nodeModulesDir, 'typeorm', 'cli.js');
const typeormSourceDir = path.join(
    rootDir,
    'src',
    'infrastructure',
    'persistence',
    'typeorm',
);
const typeormDistDir = path.join(
    rootDir,
    'dist',
    'src',
    'infrastructure',
    'persistence',
    'typeorm',
);
const tsDataSourcePath = path.join(typeormSourceDir, 'data-source.ts');
const jsDataSourcePath = path.join(typeormDistDir, 'data-source.js');
const tsSeedPath = path.join(
    rootDir,
    'src',
    'infrastructure',
    'database',
    'seeds',
    'seed.ts',
);
const jsSeedPath = path.join(
    rootDir,
    'dist',
    'src',
    'infrastructure',
    'database',
    'seeds',
    'seed.js',
);

function main() {
    const { command, mode, extraArgs } = parseArgs(process.argv.slice(2));

    if (!command) {
        fail(
            'Usage: node scripts/db-command.js <migration:run|migration:revert|migration:create|migration:generate|seed> [--mode=auto|ts|js] [extra args]',
        );
    }

    const runtime = resolveRuntime(mode, command);
    const result = runCommand(runtime, command, extraArgs);

    if (typeof result.status === 'number' && result.status !== 0) {
        process.exit(result.status);
    }

    if (result.error) {
        fail(result.error.message || String(result.error));
    }
}

function parseArgs(argv) {
    let command;
    let mode = 'auto';
    const extraArgs = [];

    for (const arg of argv) {
        if (!command && !arg.startsWith('--')) {
            command = arg;
            continue;
        }

        if (arg.startsWith('--mode=')) {
            mode = arg.slice('--mode='.length);
            continue;
        }

        extraArgs.push(arg);
    }

    return { command, mode, extraArgs };
}

function resolveRuntime(mode, command) {
    const normalizedMode = normalizeMode(mode);
    const hasTsConfig = fs.existsSync(path.join(rootDir, 'tsconfig.json'));
    const hasTsDataSource = fs.existsSync(tsDataSourcePath);
    const hasJsDataSource = fs.existsSync(jsDataSourcePath);
    const hasTsSeed = fs.existsSync(tsSeedPath);
    const hasJsSeed = fs.existsSync(jsSeedPath);
    const hasTsNode = canResolve('ts-node/register');
    const hasTsconfigPaths = canResolve('tsconfig-paths/register');

    const canUseTs =
        hasTsConfig &&
        hasTsNode &&
        (command === 'seed' ? hasTsSeed : hasTsDataSource);
    const canUseJs = command === 'seed' ? hasJsSeed : hasJsDataSource;

    if (normalizedMode === 'ts') {
        if (!canUseTs) {
            fail(
                'TS runtime is unavailable. Expected tsconfig.json, ts-node, and source files.',
            );
        }
        return {
            kind: 'ts',
            registerArgs: [
                '-r',
                'ts-node/register',
                ...(hasTsconfigPaths ? ['-r', 'tsconfig-paths/register'] : []),
            ],
        };
    }

    if (normalizedMode === 'js') {
        if (!canUseJs) {
            fail(
                'JS runtime is unavailable. Build the project first so dist migration files exist.',
            );
        }
        return { kind: 'js', registerArgs: [] };
    }

    if (canUseTs) {
        return {
            kind: 'ts',
            registerArgs: [
                '-r',
                'ts-node/register',
                ...(hasTsconfigPaths ? ['-r', 'tsconfig-paths/register'] : []),
            ],
        };
    }

    if (canUseJs) {
        return { kind: 'js', registerArgs: [] };
    }

    fail(
        'No valid migration runtime found. Either install dev dependencies for TS mode or build the project for JS mode.',
    );
}

function normalizeMode(mode) {
    if (mode === 'auto' || mode === 'ts' || mode === 'js') {
        return mode;
    }

    fail(`Unsupported mode: ${mode}`);
}

function runCommand(runtime, command, extraArgs) {
    const env = {
        ...process.env,
        DB_MIGRATION_GLOB: runtime.kind,
    };

    if (command === 'seed') {
        const scriptPath = runtime.kind === 'ts' ? tsSeedPath : jsSeedPath;
        return spawn(process.execPath, [...runtime.registerArgs, scriptPath], env);
    }

    if (!fs.existsSync(typeormCliPath)) {
        fail('typeorm CLI not found in node_modules');
    }

    const dataSourcePath =
        runtime.kind === 'ts' ? tsDataSourcePath : jsDataSourcePath;

    return spawn(
        process.execPath,
        [
            ...runtime.registerArgs,
            typeormCliPath,
            '-d',
            dataSourcePath,
            command,
            ...extraArgs,
        ],
        env,
    );
}

function spawn(command, args, env) {
    return spawnSync(command, args, {
        cwd: rootDir,
        stdio: 'inherit',
        env,
    });
}

function canResolve(request) {
    try {
        require.resolve(request, { paths: [rootDir, nodeModulesDir] });
        return true;
    } catch {
        return false;
    }
}

function fail(message) {
    console.error(message);
    process.exit(1);
}

main();
