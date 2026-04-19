import * as fs from 'fs';
import * as path from 'path';
import { buildTypeOrmOptions } from '../utils/build-typeorm-options.util';
import {
    GlobalSettingEntity,
    SearchBaseCatalogEntity,
    TYPEORM_ENTITIES,
    WidgetLocaleEntity,
} from '../../entities';
import { getMetadataArgsStorage } from 'typeorm';

describe('buildTypeOrmOptions', () => {
    it('registers postgres settings, entities, and migrations for TypeORM', () => {
        const options = buildTypeOrmOptions({
            postgresUrl: 'postgres://postgres:postgres@localhost:5432/developer-ai',
            ssl: true,
            runtimeDir: '/workspace/server/src/infrastructure/persistence/typeorm',
        }) as { url?: string; ssl?: unknown; type: string; synchronize: boolean; entities: unknown; migrations: unknown[] };

        expect(options.type).toBe('postgres');
        expect(options.url).toBe(
            'postgres://postgres:postgres@localhost:5432/developer-ai',
        );
        expect(options.ssl).toEqual({ rejectUnauthorized: false });
        expect(options.synchronize).toBe(false);
        expect(options.entities).toBe(TYPEORM_ENTITIES);
        expect(options.migrations).toEqual([
            '/workspace/server/src/infrastructure/persistence/typeorm/migrations/[0-9]*{.ts,.js}',
        ]);
    });

    it('exports the reference slice entities for feature-module registration', () => {
        expect(TYPEORM_ENTITIES).toEqual(
            expect.arrayContaining([
                WidgetLocaleEntity,
                GlobalSettingEntity,
                SearchBaseCatalogEntity,
            ]),
        );
    });

    it('uses the migration-compatible unique constraint name for search-base catalog', () => {
        const unique = getMetadataArgsStorage().uniques.find(
            (item) => item.target === SearchBaseCatalogEntity,
        );

        expect(unique?.name).toBe(
            'search_base_catalog_locale_document_id_key',
        );
        expect(unique?.columns).toEqual(['locale', 'documentId']);
    });

    it('points the seed entrypoint at the new TypeORM datasource path', () => {
        const seedSource = fs.readFileSync(
            path.resolve(
                __dirname,
                '../../../../database/seeds/seed.ts',
            ),
            'utf8',
        );

        expect(seedSource).toContain(
            "from '../../persistence/typeorm/data-source'",
        );
        expect(seedSource).not.toContain("from '../data-source'");
    });

    it('imports ConfigModule into TypeOrmModule.forRootAsync so SecretsConfig is resolvable', () => {
        const moduleSource = fs.readFileSync(
            path.resolve(__dirname, '../../typeorm.module.ts'),
            'utf8',
        );

        expect(moduleSource).toContain('TypeOrmModule.forRootAsync({');
        expect(moduleSource).toContain('imports: [ConfigModule],');
        expect(moduleSource).toContain('inject: [SecretsConfig],');
    });

    it('limits migration discovery to timestamped files so index.ts does not duplicate migrations', () => {
        const options = buildTypeOrmOptions({
            postgresUrl: 'postgres://postgres:postgres@localhost:5432/developer-ai',
            ssl: false,
            runtimeDir: '/workspace/server/src/infrastructure/persistence/typeorm',
        }) as { migrations: unknown[] };

        expect(options.migrations).toEqual([
            '/workspace/server/src/infrastructure/persistence/typeorm/migrations/[0-9]*{.ts,.js}',
        ]);
    });
});
