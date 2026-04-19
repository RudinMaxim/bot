import 'reflect-metadata';
import * as fs from 'fs';
import { DataSource } from 'typeorm';
import { getEnvFilePaths } from '../../config/env-paths';
import { buildTypeOrmOptions } from './common/utils/build-typeorm-options.util';

type EnvMap = Record<string, string>;

const parseEnvFile = (content: string): EnvMap => {
    const result: EnvMap = {};
    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        result[key] = value;
    }
    return result;
};

const loadEnvFallback = (): void => {
    for (const fullPath of getEnvFilePaths()) {
        try {
            if (!fs.existsSync(fullPath)) continue;
            const parsed = parseEnvFile(fs.readFileSync(fullPath, 'utf8'));
            for (const [key, value] of Object.entries(parsed)) {
                if (!process.env[key]) process.env[key] = value;
            }
        } catch {
            // Ignore env load failures so datasource import stays tolerant.
        }
    }
};

loadEnvFallback();

const postgresUrl =
    process.env.POSTGRES_URL ??
    'postgres://postgres:postgres@localhost:5432/developer-ai';

const AppDataSource = new DataSource(
    buildTypeOrmOptions({
        postgresUrl,
        ssl: process.env.POSTGRES_SSL === 'true',
        runtimeDir: __dirname,
    }),
);

export default AppDataSource;
