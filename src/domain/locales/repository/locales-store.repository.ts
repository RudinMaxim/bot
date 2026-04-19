import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { WidgetLocaleEntity } from 'src/infrastructure/persistence/typeorm/entities';
import { Repository } from 'typeorm';
import type { LocaleData } from '../common/types';

export interface LocaleSettingsStoreRecord {
    id: number;
    locale: string;
    data: Record<string, unknown>;
    version: string;
    createdAt?: Date;
    updatedAt?: Date;
}

@Injectable()
export class LocalesStoreRepository {
    constructor(
        @InjectRepository(WidgetLocaleEntity)
        private readonly repository: Repository<WidgetLocaleEntity>,
    ) {}

    async get(locale: string): Promise<LocaleSettingsStoreRecord | null> {
        const entity = await this.repository.findOne({
            where: { locale },
        });
        return entity ? this.mapEntity(entity) : null;
    }

    async upsert(
        locale: string,
        data: LocaleData,
        version: string,
    ): Promise<LocaleSettingsStoreRecord> {
        const payload = {
            locale,
            data,
            version,
        } as never;
        await this.repository.upsert(payload, ['locale']);
        const entity = await this.repository.findOneOrFail({
            where: { locale },
        });
        return this.mapEntity(entity);
    }

    private mapEntity(
        entity: WidgetLocaleEntity,
    ): LocaleSettingsStoreRecord {
        return {
            id: Number(entity.id),
            locale: entity.locale,
            data: entity.data,
            version: entity.version,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
        };
    }
}
