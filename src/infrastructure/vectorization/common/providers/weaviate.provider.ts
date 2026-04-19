import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import weaviate, {
    WeaviateClient,
    ApiKey,
    FusionType,
} from 'weaviate-ts-client';
import type {
    Metadata,
    MetadataFilter,
    MetadataValue,
    SearchOptions,
    SearchResult,
    VectorStore,
    VectorStoreObject,
    VectorStoreStats,
    WeaviateClientConfig,
    WeaviateObject,
    WeaviateWhere,
    WeaviateWhereCondition,
} from '../types';
import { SecretsConfig } from 'src/infrastructure/config';

@Injectable()
export class WeaviateVectorStore implements VectorStore, OnModuleInit {
    private readonly logger = new Logger(WeaviateVectorStore.name);
    private client: WeaviateClient;

    constructor(private readonly config: SecretsConfig) {}

    async onModuleInit(): Promise<void> {
        await this.initialize();
    }

    async initialize(): Promise<void> {
        await this.initializeClient();
        await this.ensureSchema();
    }

    async store(
        text: string,
        vector: number[],
        metadata: Metadata,
        id?: string,
    ): Promise<VectorStoreObject> {
        const now = new Date().toISOString();
        const properties = {
            text,
            ...metadata,
            createdAt: now,
            updatedAt: now,
        };

        try {
            let creator = this.client.data
                .creator()
                .withClassName(this.config.embedding.databaseClassName)
                .withProperties(properties)
                .withVector(vector);

            if (id) {
                creator = creator.withId(id);
            }

            const response = await creator.do();

            const storedId = response.id || id || `generated_${Date.now()}`;
            this.logger.debug(`Stored vector with ID: ${storedId}`);

            return {
                id: storedId,
                text,
                vector,
                metadata,
                createdAt: now,
                updatedAt: now,
            };
        } catch (error) {
            this.logger.error(`Failed to store vector: ${error.message}`);
            throw error;
        }
    }

    async storeBatch(
        items: Array<{
            text: string;
            vector: number[];
            metadata: Metadata;
        }>,
    ): Promise<VectorStoreObject[]> {
        const now = new Date().toISOString();
        const batcher = this.client.batch.objectsBatcher();
        const objects: VectorStoreObject[] = [];

        for (const [index, item] of items.entries()) {
            const properties = {
                text: item.text,
                ...item.metadata,
                createdAt: now,
                updatedAt: now,
            };

            batcher.withObject({
                class: this.config.embedding.databaseClassName,
                properties,
                vector: item.vector,
            });

            objects.push({
                id: `batch_${index}_${Date.now()}`,
                text: item.text,
                vector: item.vector,
                metadata: item.metadata,
                createdAt: now,
                updatedAt: now,
            });
        }

        await batcher.do();
        this.logger.log(`Batch stored ${objects.length} vectors`);
        return objects;
    }

    async search(
        queryVector: number[],
        options: SearchOptions = {},
    ): Promise<SearchResult[]> {
        if (options.signal?.aborted) {
            throw Object.assign(new Error('cancelled'), { code: 'CANCELLED' });
        }

        const limit =
            typeof options.limit === 'number'
                ? Math.min(options.limit, 100)
                : 10;
        const distance =
            typeof options.distance === 'number' ? options.distance : 0.5;

        const fields = [
            'text',
            'dataset',
            'contentType',
            'documentId',
            'externalId',
            'locale',
            'title',
            'description',
            'content',
            'source',
            'url',
            'contentHash',
            'contentLength',
            'sectionCount',
            'order',
            'sectionIndex',
            'totalSections',
            'length',
            'compressionRatio',
            'wordsPreserved',
            'wordsRemoved',
            'embeddingDimensions',
            'generationTime',
            'hasMultipleSections',
            'sectionSeparator',
            'sourceUpdatedAt',
            'createdAt',
            'updatedAt',
            '_additional { id distance certainty score explainScore }',
        ].join(' ');

        let query = this.client.graphql
            .get()
            .withClassName(this.config.embedding.databaseClassName)
            .withFields(fields)
            .withLimit(limit);

        if (options.strategy === 'hybrid' && options.queryText?.trim()) {
            query = query.withHybrid({
                query: options.queryText.trim(),
                vector: queryVector,
                alpha: options.hybridAlpha,
                properties: options.queryProperties,
                fusionType: FusionType.relativeScoreFusion,
            });
        } else {
            query = query.withNearVector({ vector: queryVector, distance });
        }

        if (typeof options.offset === 'number' && options.offset > 0) {
            query = query.withOffset(options.offset);
        }

        if (options.filters) {
            const where = this.buildWhereFilter(options.filters);
            if (where) {
                query = query.withWhere(where);
            }
        }

        try {
            const result = await query.do();
            const items: any[] =
                result.data.Get[this.config.embedding.databaseClassName] || [];

            return items.map((item: any) => {
                const distance = this.resolveResultDistance(
                    item as WeaviateObject,
                    options.strategy,
                );

                return {
                    id: item._additional.id,
                    text: item.text,
                    metadata: this.extractMetadata(item as WeaviateObject),
                    distance: distance,
                };
            });
        } catch (error) {
            this.logger.error(`Search failed: ${error.message}`);
            throw error;
        }
    }

    private resolveResultDistance(
        item: WeaviateObject,
        strategy?: SearchOptions['strategy'],
    ): number {
        if (typeof item._additional.distance === 'number') {
            return item._additional.distance;
        }

        if (typeof item._additional.certainty === 'number') {
            return 1 - item._additional.certainty;
        }

        if (strategy === 'hybrid') {
            return 1.0;
        }

        return 1.0;
    }

    async update(
        id: string,
        vector?: number[],
        metadata?: Record<string, any>,
    ): Promise<VectorStoreObject> {
        const now = new Date().toISOString();

        try {
            const updateData = {
                ...metadata,
                updatedAt: now,
            };

            let updater = this.client.data
                .updater()
                .withClassName(this.config.embedding.databaseClassName)
                .withId(id)
                .withProperties(updateData);

            if (Array.isArray(vector) && vector.length > 0) {
                updater = updater.withVector(vector);
            }

            await updater.do();

            this.logger.debug(`Updated vector: ${id}`);

            return {
                id,
                text: metadata?.text || '',
                vector: vector ?? [],
                metadata: metadata || {},
                createdAt: metadata?.createdAt || now,
                updatedAt: now,
            };
        } catch (error) {
            this.logger.error(`Update failed for ${id}: ${error.message}`);
            throw error;
        }
    }

    async delete(filters: MetadataFilter): Promise<number> {
        try {
            const where = this.buildWhereFilter(filters);
            let deleter = this.client.batch
                .objectsBatchDeleter()
                .withClassName(this.config.embedding.databaseClassName);

            if (where) {
                deleter = deleter.withWhere(where);
            }

            const result = await deleter.do();
            const deleted = result.results?.successful || 0;

            this.logger.log(`Deleted ${deleted} vectors`);
            return deleted;
        } catch (error) {
            this.logger.error(`Delete failed: ${error.message}`);
            throw error;
        }
    }

    async deleteById(id: string): Promise<boolean> {
        try {
            await this.client.data
                .deleter()
                .withClassName(this.config.embedding.databaseClassName)
                .withId(id)
                .do();
            return true;
        } catch (error) {
            this.logger.error(`Delete by ID failed: ${error.message}`);
            throw error;
        }
    }

    async deleteByIds(ids: string[]): Promise<number> {
        let deleted = 0;
        for (const id of ids) {
            try {
                await this.deleteById(id);
                deleted += 1;
            } catch (error) {
                this.logger.warn(
                    `Failed to delete vector ${id}: ${error.message}`,
                );
            }
        }
        return deleted;
    }

    async getById(id: string): Promise<VectorStoreObject | null> {
        try {
            const response = await this.client.data
                .getterById()
                .withClassName(this.config.embedding.databaseClassName)
                .withId(id)
                .do();

            if (!response) return null;

            const properties =
                (response as { properties?: Record<string, unknown> })
                    .properties || {};
            const text =
                typeof properties.text === 'string' ? properties.text : '';

            return {
                id: (response as { id?: string }).id || id,
                text,
                vector: [],
                metadata: this.extractMetadata(properties as WeaviateObject),
                createdAt:
                    typeof properties.createdAt === 'string'
                        ? properties.createdAt
                        : new Date().toISOString(),
                updatedAt:
                    typeof properties.updatedAt === 'string'
                        ? properties.updatedAt
                        : new Date().toISOString(),
            };
        } catch (error) {
            if (error?.message?.includes('404')) {
                return null;
            }
            this.logger.error(`Failed to get vector ${id}: ${error.message}`);
            throw error;
        }
    }

    async getStats(): Promise<VectorStoreStats> {
        try {
            const meta = await this.client.misc.metaGetter().do();
            const result = await this.client.graphql
                .aggregate()
                .withClassName(this.config.embedding.databaseClassName)
                .withFields('meta { count }')
                .do();

            const count =
                result.data.Aggregate[
                    this.config.embedding.databaseClassName
                ]?.[0]?.meta?.count || 0;

            return {
                connected: true,
                version: meta.version,
                objectCount: count,
                className: this.config.embedding.databaseClassName,
            };
        } catch (error) {
            return {
                connected: false,
                error: error.message,
            };
        }
    }

    async healthCheck(): Promise<boolean> {
        try {
            await this.client.misc.liveChecker().do();
            return true;
        } catch {
            return false;
        }
    }

    async count(
        queryVector?: number[],
        options: SearchOptions = {},
    ): Promise<number> {
        try {
            let query = this.client.graphql
                .aggregate()
                .withClassName(this.config.embedding.databaseClassName)
                .withFields('meta { count }');

            if (queryVector) {
                query = query.withNearVector({
                    vector: queryVector,
                    distance: options.distance,
                });
            }

            if (options.filters) {
                const where = this.buildWhereFilter(options.filters);
                if (where) {
                    query = query.withWhere(where);
                }
            }

            const result = await query.do();
            const rawCount =
                result.data.Aggregate[
                    this.config.embedding.databaseClassName
                ]?.[0]?.meta?.count;
            const count =
                typeof rawCount === 'number' ? rawCount : Number(rawCount) || 0;
            return count;
        } catch (error) {
            this.logger.error(`Count failed: ${error.message}`);
            throw error;
        }
    }

    private async initializeClient(): Promise<void> {
        try {
            const clientConfig: WeaviateClientConfig = {
                scheme: this.config.embedding.databaseUrl.startsWith('https')
                    ? 'https'
                    : 'http',
                host: this.config.embedding.databaseUrl.replace(
                    /^https?:\/\//,
                    '',
                ),
                timeout: this.config.embedding.databaseTimeout,
            };

            if (this.config.embedding.databaseApiKey) {
                clientConfig.apiKey = new ApiKey(
                    this.config.embedding.databaseApiKey,
                );
            }

            this.client = weaviate.client(clientConfig);
            await this.client.misc.metaGetter().do();

            this.logger.log(
                `Connected to Weaviate at ${this.config.embedding.databaseUrl}`,
            );
        } catch (error) {
            this.logger.error(
                `Failed to initialize Weaviate: ${error.message}`,
            );
            throw error;
        }
    }

    private async ensureSchema(): Promise<void> {
        try {
            const exists = await this.client.schema
                .classGetter()
                .withClassName(this.config.embedding.databaseClassName)
                .do()
                .catch(() => null);

            if (!exists) {
                await this.createSchema();
            } else {
                this.logger.log(
                    `Schema ${this.config.embedding.databaseClassName} exists`,
                );
                await this.ensureSchemaProperties(exists);
            }
        } catch (error) {
            this.logger.error(`Schema management failed: ${error.message}`);
            throw error;
        }
    }

    private async createSchema(): Promise<void> {
        const schema = {
            class: this.config.embedding.databaseClassName,
            description: 'Vector embeddings with metadata',
            vectorizer: 'none',
            properties: this.getDesiredProperties(),
            vectorIndexConfig: {
                distance: 'cosine',
                efConstruction: 128,
                maxConnections: 64,
            },
        };

        await this.client.schema.classCreator().withClass(schema).do();
        this.logger.log(
            `Created schema: ${this.config.embedding.databaseClassName}`,
        );
    }

    private getDesiredProperties(): Array<{
        name: string;
        dataType: string[];
        indexFilterable?: boolean;
        indexSearchable?: boolean;
    }> {
        return [
            {
                name: 'text',
                dataType: ['text'],
                indexFilterable: true,
                indexSearchable: true,
            },
            {
                name: 'dataset',
                dataType: ['text'],
                indexFilterable: true,
            },
            {
                name: 'contentType',
                dataType: ['text'],
                indexFilterable: true,
            },
            {
                name: 'documentId',
                dataType: ['text'],
                indexFilterable: true,
            },
            {
                name: 'externalId',
                dataType: ['text'],
                indexFilterable: true,
            },
            {
                name: 'locale',
                dataType: ['text'],
                indexFilterable: true,
            },
            {
                name: 'title',
                dataType: ['text'],
                indexSearchable: true,
            },
            {
                name: 'description',
                dataType: ['text'],
                indexSearchable: true,
            },
            {
                name: 'content',
                dataType: ['text'],
                indexSearchable: true,
            },
            {
                name: 'source',
                dataType: ['text'],
                indexFilterable: true,
            },
            {
                name: 'url',
                dataType: ['text'],
                indexFilterable: false,
            },
            {
                name: 'contentHash',
                dataType: ['text'],
                indexFilterable: true,
            },
            {
                name: 'contentLength',
                dataType: ['number'],
                indexFilterable: true,
            },
            {
                name: 'sectionCount',
                dataType: ['int'],
                indexFilterable: true,
            },
            {
                name: 'order',
                dataType: ['int'],
                indexFilterable: true,
            },
            {
                name: 'sectionIndex',
                dataType: ['int'],
                indexFilterable: true,
            },
            {
                name: 'totalSections',
                dataType: ['int'],
                indexFilterable: true,
            },
            {
                name: 'length',
                dataType: ['int'],
                indexFilterable: true,
            },
            {
                name: 'compressionRatio',
                dataType: ['number'],
                indexFilterable: true,
            },
            {
                name: 'wordsPreserved',
                dataType: ['int'],
                indexFilterable: true,
            },
            {
                name: 'wordsRemoved',
                dataType: ['int'],
                indexFilterable: true,
            },
            {
                name: 'embeddingDimensions',
                dataType: ['int'],
                indexFilterable: true,
            },
            {
                name: 'generationTime',
                dataType: ['int'],
                indexFilterable: true,
            },
            {
                name: 'hasMultipleSections',
                dataType: ['boolean'],
                indexFilterable: true,
            },
            {
                name: 'sectionSeparator',
                dataType: ['text'],
                indexFilterable: true,
            },
            {
                name: 'sourceUpdatedAt',
                dataType: ['date'],
                indexFilterable: true,
            },
            {
                name: 'createdAt',
                dataType: ['date'],
                indexFilterable: true,
            },
            {
                name: 'updatedAt',
                dataType: ['date'],
                indexFilterable: true,
            },
        ];
    }

    private async ensureSchemaProperties(existingSchema: {
        properties?: Array<{ name?: string }>;
    }): Promise<void> {
        const existing = new Set(
            (existingSchema.properties || [])
                .map((prop) => prop.name)
                .filter((name): name is string => Boolean(name)),
        );
        const desired = this.getDesiredProperties();

        for (const property of desired) {
            if (existing.has(property.name)) continue;

            await this.client.schema
                .propertyCreator()
                .withClassName(this.config.embedding.databaseClassName)
                .withProperty(property)
                .do();
            this.logger.log(`Added schema property: ${property.name}`);
        }
    }

    private buildWhereFilter(filters: MetadataFilter): WeaviateWhere {
        const conditions: WeaviateWhereCondition[] = [];

        for (const [key, value] of Object.entries(filters)) {
            if (value === null || value === undefined) {
                continue;
            }

            if (Array.isArray(value)) {
                if (value.length === 0) continue;
                const first = value[0];
                if (typeof first === 'string') {
                    conditions.push({
                        path: [key],
                        operator: 'ContainsAny',
                        valueTextArray: value as string[],
                    });
                } else if (typeof first === 'number') {
                    conditions.push({
                        path: [key],
                        operator: 'ContainsAny',
                        valueNumberArray: value as number[],
                    });
                } else if (typeof first === 'boolean') {
                    conditions.push({
                        path: [key],
                        operator: 'ContainsAny',
                        valueBooleanArray: value as boolean[],
                    });
                }
                continue;
            }

            if (this.isRangeValue(value)) {
                if (value.after) {
                    const after = this.toDateValue(value.after);
                    if (after) {
                        conditions.push({
                            path: [key],
                            operator: 'GreaterThan',
                            valueDate: after,
                        });
                    }
                }

                if (value.before) {
                    const before = this.toDateValue(value.before);
                    if (before) {
                        conditions.push({
                            path: [key],
                            operator: 'LessThan',
                            valueDate: before,
                        });
                    }
                }
                continue;
            }

            if (typeof value === 'string') {
                conditions.push({
                    path: [key],
                    operator: 'Equal',
                    valueText: value,
                });
            } else if (typeof value === 'number') {
                conditions.push({
                    path: [key],
                    operator: 'Equal',
                    valueNumber: value,
                });
            } else if (typeof value === 'boolean') {
                conditions.push({
                    path: [key],
                    operator: 'Equal',
                    valueBoolean: value,
                });
            } else if (value instanceof Date) {
                conditions.push({
                    path: [key],
                    operator: 'Equal',
                    valueDate: value.toISOString(),
                });
            }
        }

        if (conditions.length === 0) return null;
        if (conditions.length === 1) return conditions[0];

        return {
            operator: 'And',
            operands: conditions,
        };
    }

    private isRangeValue(
        value: unknown,
    ): value is { before?: Date | string; after?: Date | string } {
        return (
            typeof value === 'object' &&
            value !== null &&
            ('before' in value || 'after' in value)
        );
    }

    private toDateValue(value: Date | string): string | null {
        if (value instanceof Date) {
            return value.toISOString();
        }
        const parsed = new Date(value);
        if (isNaN(parsed.getTime())) {
            return null;
        }
        return parsed.toISOString();
    }

    private extractMetadata(metadata: WeaviateObject): Metadata {
        const result: Metadata = {};
        const { text: _text, _additional, ...payload } = metadata;

        for (const [key, value] of Object.entries(payload)) {
            if (
                value !== null &&
                value !== undefined &&
                (typeof value === 'string' ||
                    typeof value === 'number' ||
                    typeof value === 'boolean' ||
                    value instanceof Date ||
                    Array.isArray(value))
            ) {
                result[key] = value as MetadataValue;
            }
        }
        return result;
    }
}
