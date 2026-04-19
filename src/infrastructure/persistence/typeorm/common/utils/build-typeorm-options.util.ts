import * as path from 'path';
import type { DataSourceOptions } from 'typeorm';
import { TYPEORM_ENTITIES } from '../../entities';

export interface BuildTypeOrmOptionsInput {
    postgresUrl: string;
    ssl: boolean;
    runtimeDir: string;
}

export function buildTypeOrmOptions(
    input: BuildTypeOrmOptionsInput,
): DataSourceOptions {
    const migrationGlob = path
        .join(input.runtimeDir, 'migrations/[0-9]*{.ts,.js}')
        .replace(/\\/g, '/');

    return {
        type: 'postgres',
        url: input.postgresUrl,
        ssl: input.ssl ? { rejectUnauthorized: false } : undefined,
        entities: TYPEORM_ENTITIES,
        migrations: [migrationGlob],
        synchronize: false,
        logging: false,
    };
}
