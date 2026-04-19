import { Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EMBEDDING_STATUS } from 'src/infrastructure/vectorization/common/constants/embedding-status.const';
import {
    EntityManager,
    In,
    Repository,
} from 'typeorm';
import { SearchBaseCatalogEntity } from 'src/infrastructure/persistence/typeorm/entities';
import type { SearchBaseEmbeddingStatus } from '../common/constants';

export interface SearchBaseCatalogRecord {
    id: number;
    locale: string;
    documentId: string;
    externalId?: string;
    title: string;
    description: string;
    content?: string;
    url?: string;
    source?: string;
    contentHash: string;
    sourceUpdatedAt: string;
    contentLength: number;
    sectionCount?: number;
    order?: number;
    vectorId?: string;
    embeddingStatus?: SearchBaseEmbeddingStatus;
    embeddingError?: string | null;
    embeddingUpdatedAt?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface SearchBaseCatalogUpsert {
    locale: string;
    documentId: string;
    externalId?: string;
    title: string;
    description: string;
    content?: string;
    url?: string;
    source?: string;
    contentHash: string;
    sourceUpdatedAt: string;
    contentLength: number;
    sectionCount?: number;
    order?: number;
    vectorId?: string;
    embeddingStatus?: SearchBaseEmbeddingStatus;
    embeddingError?: string | null;
    embeddingUpdatedAt?: string;
}

@Injectable()
export class SearchBaseCatalogRepository {
    constructor(
        @InjectRepository(SearchBaseCatalogEntity)
        private readonly repository: Repository<SearchBaseCatalogEntity>,
        @InjectEntityManager()
        private readonly entityManager: EntityManager,
    ) {}

    async findByDocumentId(
        locale: string,
        documentId: string,
    ): Promise<SearchBaseCatalogRecord | null> {
        const entity = await this.repository.findOne({
            where: { locale, documentId },
        });
        return entity ? this.mapEntity(entity) : null;
    }

    async findByDocumentIds(
        locale: string,
        documentIds: string[],
    ): Promise<SearchBaseCatalogRecord[]> {
        if (!documentIds.length) return [];

        const entities = await this.repository.find({
            where: {
                locale,
                documentId: In(documentIds),
            },
        });

        return entities.map((entity) => this.mapEntity(entity));
    }

    async listByLocale(locale: string): Promise<SearchBaseCatalogRecord[]> {
        const entities = await this.repository.find({
            where: { locale },
        });

        return [...entities]
            .sort((left, right) => this.compareByOrder(left, right))
            .map((entity) => this.mapEntity(entity));
    }

    async listForEmbeddingRefresh(
        limit: number,
        options?: {
            locale?: string;
            force?: boolean;
            afterId?: number;
        },
    ): Promise<SearchBaseCatalogRecord[]> {
        if (limit <= 0) return [];

        const qb = this.repository.createQueryBuilder('catalog');

        if (options?.locale) {
            qb.where('catalog.locale = :locale', { locale: options.locale });
        }

        if (!options?.force) {
            qb.andWhere(
                '(catalog.embeddingStatus IS DISTINCT FROM :ready OR catalog.embeddingUpdatedAt IS NULL OR catalog.vectorId IS NULL)',
                { ready: EMBEDDING_STATUS.READY },
            );
        }

        if (typeof options?.afterId === 'number') {
            qb.andWhere('catalog.id > :afterId', { afterId: options.afterId });
        }

        qb.orderBy(
            options?.force ? 'catalog.id' : 'catalog.updatedAt',
            'ASC',
        ).take(limit);

        const entities = await qb.getMany();
        return entities.map((entity) => this.mapEntity(entity));
    }

    async upsert(
        payload: SearchBaseCatalogUpsert,
    ): Promise<SearchBaseCatalogRecord> {
        const entity = this.buildUpsertEntity(payload);
        await this.repository.upsert(entity, ['locale', 'documentId']);

        const reloaded = await this.repository.findOneOrFail({
            where: {
                locale: payload.locale,
                documentId: payload.documentId,
            },
        });

        return this.mapEntity(reloaded);
    }

    async markEmbeddingReady(
        locale: string,
        documentId: string,
        payload: {
            vectorId: string;
            contentLength: number;
            sectionCount: number;
        },
    ): Promise<void> {
        await this.repository.update(
            { locale, documentId },
            {
                embeddingStatus: EMBEDDING_STATUS.READY,
                embeddingUpdatedAt: new Date().toISOString(),
                vectorId: payload.vectorId,
                contentLength: payload.contentLength,
                sectionCount: payload.sectionCount,
                embeddingError: null,
                updatedAt: new Date(),
            } as Partial<SearchBaseCatalogEntity>,
        );
    }

    async markEmbeddingFailed(
        locale: string,
        documentId: string,
        error: string,
    ): Promise<void> {
        await this.repository.update(
            { locale, documentId },
            {
                embeddingStatus: EMBEDDING_STATUS.FAILED,
                embeddingUpdatedAt: new Date().toISOString(),
                embeddingError: error,
                updatedAt: new Date(),
            } as Partial<SearchBaseCatalogEntity>,
        );
    }

    async updateOrder(
        locale: string,
        documentId: string,
        order: number,
    ): Promise<SearchBaseCatalogRecord | null> {
        const result = await this.repository.update(
            { locale, documentId },
            {
                order,
                updatedAt: new Date(),
            } as Partial<SearchBaseCatalogEntity>,
        );

        if ((result.affected ?? 0) === 0) {
            return null;
        }

        const entity = await this.repository.findOne({
            where: { locale, documentId },
        });
        return entity ? this.mapEntity(entity) : null;
    }

    async updateOrders(locale: string, documentIds: string[]): Promise<void> {
        if (!documentIds.length) return;

        await this.entityManager.query(
            `
            WITH data AS (
                SELECT
                    input.document_id,
                    input.sort_order
                FROM unnest($2::text[]) WITH ORDINALITY AS input(document_id, sort_order)
            )
            UPDATE search_base_catalog AS catalog
            SET sort_order = data.sort_order,
                updated_at = now()
            FROM data
            WHERE catalog.locale = $1
              AND catalog.document_id = data.document_id
            `,
            [locale, documentIds],
        );
    }

    async deleteByDocumentId(
        locale: string,
        documentId: string,
    ): Promise<boolean> {
        const result = await this.repository.delete({ locale, documentId });
        return (result.affected ?? 0) > 0;
    }

    async deleteByFilters(payload: {
        locale?: string;
        source?: string;
        updatedBefore?: string;
        documentIds?: string[];
    }): Promise<number> {
        const hasAnyFilter =
            Boolean(payload.locale) ||
            Boolean(payload.source) ||
            Boolean(payload.updatedBefore) ||
            Boolean(payload.documentIds?.length);

        if (!hasAnyFilter) {
            return 0;
        }

        const qb = this.repository
            .createQueryBuilder()
            .delete()
            .from(SearchBaseCatalogEntity);

        let hasWhere = false;

        if (payload.locale) {
            qb.where('locale = :locale', { locale: payload.locale });
            hasWhere = true;
        }

        if (payload.source) {
            if (hasWhere) {
                qb.andWhere('source = :source', { source: payload.source });
            } else {
                qb.where('source = :source', { source: payload.source });
                hasWhere = true;
            }
        }

        if (payload.updatedBefore) {
            if (hasWhere) {
                qb.andWhere('source_updated_at < :updatedBefore', {
                    updatedBefore: payload.updatedBefore,
                });
            } else {
                qb.where('source_updated_at < :updatedBefore', {
                    updatedBefore: payload.updatedBefore,
                });
                hasWhere = true;
            }
        }

        if (payload.documentIds?.length) {
            if (hasWhere) {
                qb.andWhere('document_id IN (:...documentIds)', {
                    documentIds: payload.documentIds,
                });
            } else {
                qb.where('document_id IN (:...documentIds)', {
                    documentIds: payload.documentIds,
                });
            }
        }

        const result = await qb.execute();
        return result.affected ?? 0;
    }

    private buildUpsertEntity(
        payload: SearchBaseCatalogUpsert,
    ): Partial<SearchBaseCatalogEntity> {
        const candidate: Record<string, unknown> = {
            locale: payload.locale,
            documentId: payload.documentId,
            externalId: payload.externalId,
            title: payload.title,
            description: payload.description,
            content: payload.content,
            url: payload.url,
            source: payload.source,
            contentHash: payload.contentHash,
            sourceUpdatedAt: payload.sourceUpdatedAt,
            contentLength: payload.contentLength,
            sectionCount: payload.sectionCount,
            order: payload.order,
            vectorId: payload.vectorId,
            embeddingStatus: payload.embeddingStatus,
            embeddingError: payload.embeddingError,
            embeddingUpdatedAt: payload.embeddingUpdatedAt,
        };

        return Object.fromEntries(
            Object.entries(candidate).filter(([, value]) => value !== undefined),
        ) as Partial<SearchBaseCatalogEntity>;
    }

    private compareByOrder(
        left: SearchBaseCatalogEntity,
        right: SearchBaseCatalogEntity,
    ): number {
        const leftOrder = this.normalizeNumber(left.order);
        const rightOrder = this.normalizeNumber(right.order);

        if (leftOrder !== undefined || rightOrder !== undefined) {
            if (leftOrder === undefined) return 1;
            if (rightOrder === undefined) return -1;
            if (leftOrder !== rightOrder) {
                return leftOrder - rightOrder;
            }
        }

        const leftUpdated = this.normalizeTimestamp(left.updatedAt);
        const rightUpdated = this.normalizeTimestamp(right.updatedAt);
        if (leftUpdated !== rightUpdated) {
            return leftUpdated - rightUpdated;
        }

        return this.compareById(left, right);
    }

    private compareByUpdatedAt(
        left: SearchBaseCatalogEntity,
        right: SearchBaseCatalogEntity,
    ): number {
        const leftUpdated = this.normalizeTimestamp(left.updatedAt);
        const rightUpdated = this.normalizeTimestamp(right.updatedAt);
        if (leftUpdated !== rightUpdated) {
            return leftUpdated - rightUpdated;
        }

        return this.compareById(left, right);
    }

    private compareById(
        left: SearchBaseCatalogEntity,
        right: SearchBaseCatalogEntity,
    ): number {
        return Number(left.id) - Number(right.id);
    }

    private normalizeNumber(value: number | null | undefined): number | undefined {
        return value ?? undefined;
    }

    private normalizeTimestamp(value: Date | string | null | undefined): number {
        if (!value) {
            return 0;
        }

        const date = value instanceof Date ? value : new Date(value);
        const timestamp = date.getTime();
        return Number.isNaN(timestamp) ? 0 : timestamp;
    }

    private mapEntity(entity: SearchBaseCatalogEntity): SearchBaseCatalogRecord {
        const normalize = <T>(value: T | null | undefined): T | undefined =>
            value === null || value === undefined ? undefined : value;

        return {
            id: Number(entity.id),
            locale: entity.locale,
            documentId: entity.documentId,
            externalId: normalize(entity.externalId),
            title: entity.title,
            description: entity.description,
            content: normalize(entity.content),
            url: normalize(entity.url),
            source: normalize(entity.source),
            contentHash: entity.contentHash,
            sourceUpdatedAt: entity.sourceUpdatedAt,
            contentLength: entity.contentLength,
            sectionCount: normalize(entity.sectionCount),
            order: normalize(entity.order),
            vectorId: normalize(entity.vectorId),
            embeddingStatus: normalize(
                entity.embeddingStatus as
                    | SearchBaseEmbeddingStatus
                    | null
                    | undefined,
            ),
            embeddingError:
                entity.embeddingError === undefined ? null : entity.embeddingError,
            embeddingUpdatedAt: normalize(entity.embeddingUpdatedAt),
            createdAt: this.toDate(entity.createdAt),
            updatedAt: this.toDate(entity.updatedAt),
        };
    }

    private toDate(value: Date | string | null | undefined): Date | undefined {
        if (!value) {
            return undefined;
        }

        const date = value instanceof Date ? value : new Date(value);
        return Number.isNaN(date.getTime()) ? undefined : date;
    }
}
