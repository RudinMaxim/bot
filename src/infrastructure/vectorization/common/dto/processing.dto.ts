import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString,
    IsOptional,
    IsNumber,
    IsBoolean,
    IsObject,
    Length,
    Min,
    Max,
    IsArray,
    ArrayMinSize,
    ArrayMaxSize,
    IsIn,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { BaseRequestDto } from './base.dto';
import {
    EMBEDDING_STATS_QUERY_TYPE,
    EMBEDDING_STATS_QUERY_TYPE_VALUES,
    type EmbeddingStatsQueryType,
} from '../constants';

export class ProcessTextDto extends BaseRequestDto {
    @ApiProperty({
        description: 'Текст для обработки и создания эмбеддингов',
        example:
            'Это пример текста для создания эмбеддингов. Текст может быть длинным и будет автоматически разбит на секции.',
        minLength: 10,
        maxLength: 100000,
    })
    @IsString()
    @Length(10, 100000, {
        message: 'Текст должен содержать от 10 до 100,000 символов',
    })
    text: string;

    @ApiPropertyOptional({
        description: 'Настройки обработки текста',
        example: {
            autoDetectSections: true,
            minSectionLength: 10,
            removeStopWords: true,
        },
    })
    @IsOptional()
    @IsObject()
    processingOptions?: {
        autoDetectSections?: boolean;
        minSectionLength?: number;
        removeStopWords?: boolean;
        normalizeWhitespace?: boolean;
        removeUrls?: boolean;
        removeEmails?: boolean;
    };
}

export class ProcessBatchDto extends BaseRequestDto {
    @ApiProperty({
        description: 'Массив текстов для пакетной обработки',
        example: [
            'Первый текст для обработки',
            'Второй текст для обработки',
            'Третий текст для обработки',
        ],
        type: [String],
        minItems: 1,
        maxItems: 100,
    })
    @IsArray()
    @ArrayMinSize(1, { message: 'Необходимо предоставить хотя бы один текст' })
    @ArrayMaxSize(100, { message: 'Максимум 100 текстов за один запрос' })
    @IsString({ each: true })
    @Length(1, 10000, {
        each: true,
        message: 'Каждый текст должен содержать от 1 до 10,000 символов',
    })
    texts: string[];

    @ApiPropertyOptional({
        description:
            'Нормализовать ли эмбеддинги (приведение к единичной длине)',
        default: true,
        example: true,
    })
    @IsOptional()
    @IsBoolean()
    normalize?: boolean = true;

    @ApiPropertyOptional({
        description:
            'Сохранить ли эмбеддинги в базу данных или только вернуть в ответе',
        default: true,
        example: true,
    })
    @IsOptional()
    @IsBoolean()
    storeInDatabase?: boolean = true;
}

export class SearchDto {
    @ApiProperty({
        description: 'Поисковый запрос для семантического поиска',
        example: 'машинное обучение и нейронные сети',
        minLength: 1,
        maxLength: 1000,
    })
    @IsString()
    @Length(1, 1000)
    query: string;

    @ApiPropertyOptional({
        description: 'Максимальное количество результатов поиска',
        default: 10,
        minimum: 1,
        maximum: 100,
        example: 10,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(100)
    limit?: number = 10;

    @ApiPropertyOptional({
        description:
            'Минимальная схожесть для результатов (0-1, где 1 - полное совпадение)',
        default: 0.7,
        minimum: 0,
        maximum: 1,
        example: 0.7,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @Max(1)
    threshold?: number = 0.7;

    @ApiPropertyOptional({
        description: 'Фильтр по источнику данных',
        example: 'user-documents',
        maxLength: 100,
    })
    @IsOptional()
    @IsString()
    @Length(1, 100)
    source?: string;

    @ApiPropertyOptional({
        description: 'Дополнительные фильтры поиска',
        example: {
            category: 'technology',
            createdAfter: '2024-01-01T00:00:00Z',
            minLength: 100,
        },
    })
    @IsOptional()
    @Transform(({ value }) => {
        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                if (typeof parsed !== 'object' || Array.isArray(parsed)) {
                    throw new Error('Filters must be an object');
                }
                return parsed as Record<string, unknown>;
            } catch {
                throw new Error('Invalid JSON format for filters');
            }
        }
        return value as Record<string, unknown>;
    })
    @IsObject()
    filters?: Record<string, unknown>;
}

export class UpdateVectorDto {
    @ApiPropertyOptional({
        description: 'Новый текст для генерации эмбеддинга',
        example: 'Обновленный текст документа с новой информацией',
        minLength: 1,
        maxLength: 10000,
    })
    @IsOptional()
    @IsString()
    @Length(1, 10000)
    text?: string;

    @ApiPropertyOptional({
        description: 'Готовый эмбеддинг для обновления (альтернатива тексту)',
        example: [0.1, -0.2, 0.3, 0.4, -0.1],
        type: [Number],
    })
    @IsOptional()
    @IsArray()
    @IsNumber({}, { each: true })
    @ArrayMinSize(1, { message: 'Эмбеддинг не может быть пустым' })
    @ArrayMaxSize(2048, {
        message: 'Максимальная размерность эмбеддинга: 2048',
    })
    embedding?: number[];

    @ApiPropertyOptional({
        description: 'Обновленные свойства/метаданные вектора',
        example: {
            category: 'updated',
            lastModified: '2024-01-15T12:00:00Z',
            version: 2,
            verified: true,
        },
    })
    @IsOptional()
    @IsObject()
    metadata?: Record<string, unknown>;
}

export class DeleteVectorsDto {
    @ApiPropertyOptional({
        description: 'Удалить векторы определенного источника',
        example: 'temporary-data',
    })
    @IsOptional()
    @IsString()
    @Length(1, 100)
    source?: string;

    @ApiPropertyOptional({
        description: 'Удалить векторы старше указанной даты (ISO 8601)',
        example: '2024-01-01T00:00:00Z',
    })
    @IsOptional()
    @IsString()
    olderThan?: string;

    @ApiPropertyOptional({
        description: 'Дополнительные фильтры для удаления',
        example: {
            category: 'old',
            status: 'archived',
        },
    })
    @IsOptional()
    @IsObject()
    filters?: Record<string, any>;
}

export class StatsQueryDto {
    @ApiPropertyOptional({
        description: 'Тип статистики для получения',
        enum: EMBEDDING_STATS_QUERY_TYPE_VALUES,
        default: EMBEDDING_STATS_QUERY_TYPE.BASIC,
        example: EMBEDDING_STATS_QUERY_TYPE.BASIC,
    })
    @IsOptional()
    @IsString()
    @IsIn(EMBEDDING_STATS_QUERY_TYPE_VALUES)
    type: EmbeddingStatsQueryType = EMBEDDING_STATS_QUERY_TYPE.BASIC;
}
