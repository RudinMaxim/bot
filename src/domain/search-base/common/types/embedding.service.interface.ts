import {
    ProcessedEmbeddingResult,
    MetadataValue,
} from 'src/infrastructure/vectorization/common/types';
import {
    SearchBaseSearchQuery,
    SearchBaseSearchResult,
    SearchBaseUpsertPayload,
    SearchBaseUpsertResult,
    SearchBaseItemDetails,
    SearchBaseDeletePayload,
    SearchBaseDeleteResult,
} from './search-base.types';

/**
 * Интерфейс основного сервиса эмбеддингов
 * Определяет бизнес-логику без привязки к конкретным адаптерам
 */
export interface EmbeddingServiceInterface {
    /**
     * Обрабатывает текст и создает эмбеддинги
     */
    processAndEmbedText(inputText: string): Promise<ProcessedEmbeddingResult[]>;

    /**
     * Сохраняет эмбеддинги в векторную БД
     */
    storeEmbeddings(
        results: ProcessedEmbeddingResult[],
        source: string,
    ): Promise<StoredEmbeddingResult[]>;

    /**
     * Поиск похожих текстов
     */
    searchSimilar(
        query: string,
        options: SearchOptions,
    ): Promise<SearchResult[]>;

    /**
     * Обновляет вектор
     */
    updateVector(
        id: string,
        text?: string,
        embedding?: number[],
        metadata?: Record<string, any>,
    ): Promise<StoredEmbeddingResult>;

    /**
     * Получает статистику системы
     */
    getStats(): Promise<EmbeddingStats>;

    /**
     * Проверка здоровья системы
     */
    healthCheck(): Promise<HealthStatus>;

    /**
     * Поиск по базе CMS
     */
    searchBase(
        query: SearchBaseSearchQuery,
        options?: { preferOrder?: boolean },
    ): Promise<SearchBaseSearchResult>;

    /**
     * Upsert контента CMS
     */
    upsertSearchBase(
        payload: SearchBaseUpsertPayload,
    ): Promise<SearchBaseUpsertResult>;

    /**
     * Получить документ CMS по id
     */
    getSearchBaseItem(
        id: string,
        locale: string,
    ): Promise<SearchBaseItemDetails | null>;

    /**
     * Переместить документ CMS в списке
     */
    moveSearchBaseItem(
        id: string,
        locale: string,
        after: number,
    ): Promise<SearchBaseItemDetails | null>;

    /**
     * Удалить документ CMS по id
     */
    deleteSearchBaseById(id: string, locale: string): Promise<boolean>;

    /**
     * Удалить только векторы CMS по фильтрам, не трогая catalog
     */
    deleteSearchBaseVectors(payload: {
        locale?: string;
        source?: string;
    }): Promise<number>;

    /**
     * Удалить документы CMS по фильтрам
     */
    deleteSearchBase(
        payload: SearchBaseDeletePayload,
    ): Promise<SearchBaseDeleteResult>;
}

/**
 * Результат сохранения эмбеддинга
 */
export interface StoredEmbeddingResult {
    id: string;
    success: boolean;
    error?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Опции поиска
 */
export interface SearchOptions {
    limit?: number;
    threshold?: number;
    source?: string;
    filters?: Record<string, unknown>;
    strategy?: 'vector' | 'hybrid';
    hybridAlpha?: number;
    hybridQuery?: string;
    queryProperties?: string[];
    signal?: AbortSignal;
}

/**
 * Результат поиска
 */
export interface SearchResult {
    id: string;
    text: string;
    source: MetadataValue | null;
    similarity: number;
    metadata: Record<string, unknown>;
}

/**
 * Фильтры для векторов
 */
export interface VectorFilters {
    source?: string;
    createdAfter?: Date;
    createdBefore?: Date;
    [key: string]: unknown;
}

/**
 * Результат удаления
 */
export interface DeleteResult {
    deleted: number;
    message: string;
    source?: string;
}

/**
 * Статистика эмбеддингов
 */
export interface EmbeddingStats {
    totalVectors: number;
    totalSources: number;
    averageProcessingTime: number;
    vectorizationStats: {
        model: string;
        dimensions: number;
        requestsPerMinute: number;
    };
    databaseStats: {
        totalVectors: number;
        indexStatus: string;
        responseTime: number;
    };
}

/**
 * Статус здоровья
 */
export interface HealthStatus {
    overall: boolean;
    vectorization: boolean;
    database: boolean;
    errors?: string[];
    responseTime: number;
}
