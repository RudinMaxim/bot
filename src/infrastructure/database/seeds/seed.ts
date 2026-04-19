import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import {
    buildSearchBaseSeedFromAsset,
} from '../../../domain/search-base/common/utils';
import type { SearchBaseAssetPayload } from '../../../domain/search-base/common/types';
import AppDataSource from '../../persistence/typeorm/data-source';
import {
    GlobalSettingEntity,
    SearchBaseCatalogEntity,
    WidgetLocaleEntity,
} from '../../persistence/typeorm/entities';
import { loadBootstrapAssets } from './common/utils/bootstrap-assets.util';

const GLOBAL_SETTINGS_PATH = path.resolve(__dirname, './global.json');

function computeVersion(data: unknown): string {
    return `md5:${createHash('md5').update(JSON.stringify(data)).digest('hex')}`;
}

function buildCombinedText(item: {
    title: string;
    description: string;
    content?: string;
}): string {
    return [item.title, item.description, item.content]
        .filter((value) => typeof value === 'string' && value.trim().length)
        .join('\n\n');
}

function computeHash(text: string): string {
    return createHash('sha256').update(text).digest('hex');
}

function normalizeOrder(value?: number): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
    const normalized = Math.floor(value);
    return normalized >= 1 ? normalized : undefined;
}

async function seedLocales(locales: Record<string, Record<string, unknown>>): Promise<number> {
    const repository = AppDataSource.getRepository(WidgetLocaleEntity);
    let updated = 0;

    const entries = Object.entries(locales);
    for (const [locale, data] of entries) {
        const version = computeVersion(data);

        const existing = await repository.findOne({ where: { locale } });
        if (existing?.version === version) {
            continue;
        }

        if (existing) {
            existing.data = data;
            existing.version = version;
            await repository.save(existing);
        } else {
            await repository.save(repository.create({ locale, data, version }));
        }
        updated += 1;
    }

    return updated;
}

async function seedGlobalSettings(): Promise<boolean> {
    const repository = AppDataSource.getRepository(GlobalSettingEntity);
    const raw = await fs.readFile(GLOBAL_SETTINGS_PATH, 'utf8');
    const data = JSON.parse(raw) as Record<string, unknown>;
    const version = computeVersion(data);

    const existing = await repository.findOne({
        where: { key: 'global' },
    });

    if (existing?.version === version) {
        return false;
    }

    if (existing) {
        existing.data = data;
        existing.version = version;
        await repository.save(existing);
    } else {
        await repository.save(
            repository.create({ key: 'global', data, version }),
        );
    }

    return true;
}

async function seedSearchBase(
    asset: SearchBaseAssetPayload,
): Promise<number> {
    const repository = AppDataSource.getRepository(SearchBaseCatalogEntity);
    const payload = buildSearchBaseSeedFromAsset(asset);

    if (!payload.data.length) {
        throw new Error('Canonical search-base asset is empty: mys/ru.json');
    }

    const documentIds = payload.data.map((item) => item.id);
    await repository
        .createQueryBuilder()
        .delete()
        .from(SearchBaseCatalogEntity)
        .where('locale = :locale', { locale: payload.locale })
        .andWhere('document_id <> ALL(:documentIds)', {
            documentIds,
        })
        .execute();

    let updated = 0;
    const now = new Date().toISOString();
    for (const item of payload.data) {
        const combinedText = buildCombinedText({
            title: item.title,
            description: item.description,
            content: item.content,
        });
        const contentHash = computeHash(combinedText);
        const sourceUpdatedAt = item.updatedAt || now;
        const order = normalizeOrder(item.order);
        const existing = await repository.findOne({
            where: {
                locale: payload.locale,
                documentId: item.id,
            },
        });
        const nextRecord = {
            locale: payload.locale,
            documentId: item.id,
            externalId: item.id,
            title: item.title,
            description: item.description,
            content: item.content ?? null,
            url: null,
            source: item.source ?? null,
            contentHash,
            sourceUpdatedAt,
            contentLength: combinedText.length,
            sectionCount: null,
            order: order ?? null,
            vectorId: null,
            embeddingStatus: 'pending',
            embeddingError: null,
            embeddingUpdatedAt: null,
        };

        if (existing) {
            repository.merge(existing, nextRecord);
            await repository.save(existing);
        } else {
            await repository.save(repository.create(nextRecord));
        }
        updated += 1;
    }

    return updated;
}

async function run(): Promise<void> {
    await AppDataSource.initialize();

    try {
        const bootstrapAssets = await loadBootstrapAssets();
        const localesUpdated = await seedLocales(bootstrapAssets.locales);
        const settingsUpdated = await seedGlobalSettings();
        const searchBaseUpdated = await seedSearchBase(
            bootstrapAssets.searchBase.mys.ru,
        );
        const settingsLabel = settingsUpdated ? 'updated' : 'unchanged';
        console.log(
            `Seed completed: locales updated=${localesUpdated}, global settings=${settingsLabel}, search-base upserted=${searchBaseUpdated}`,
        );
    } finally {
        await AppDataSource.destroy();
    }
}

run().catch((error) => {
    console.error(
        `Seed failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
});
