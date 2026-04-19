import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString,
    IsNumber,
    IsBoolean,
    IsObject,
    IsArray,
    Min,
    Max,
    ValidateNested,
    IsOptional,
} from 'class-validator';
import { BaseResponseDto } from './base.dto';
import { Type } from 'class-transformer';

export class ProcessedTextResultDto {
    @ApiProperty({
        description: 'Обработанный текст',
        example: 'Это пример обработанного текста для создания эмбеддингов',
    })
    @IsString()
    text: string;

    @ApiProperty({
        description: 'Индекс секции в документе',
        example: 0,
    })
    @IsNumber()
    sectionIndex: number;

    @ApiProperty({
        description: 'Общее количество секций в документе',
        example: 3,
    })
    @IsNumber()
    totalSections: number;

    @ApiProperty({
        description: 'Длина текста в символах',
        example: 1250,
    })
    @IsNumber()
    length: number;

    @ApiProperty({
        description: 'Метаданные обработки',
        example: {
            compressionRatio: 0.85,
            wordsPreserved: 120,
            wordsRemoved: 15,
            success: true,
        },
    })
    @IsObject()
    processing: {
        compressionRatio: number;
        wordsPreserved: number;
        wordsRemoved: number;
        success: boolean;
    };
}

export class EmbeddingResultDto {
    @ApiProperty({
        description: 'Уникальный идентификатор вектора',
        example: 'uuid-1234-5678-9012',
    })
    @IsString()
    id: string;

    @ApiProperty({
        description: 'Обработанный текст',
        example: 'Это пример обработанного текста для создания эмбеддингов',
    })
    @IsString()
    text: string;

    @ApiProperty({
        description: 'Вектор эмбеддинга (массив чисел)',
        example: [0.1, -0.2, 0.3, 0.4],
        type: [Number],
    })
    @IsArray()
    @IsNumber({}, { each: true })
    embedding: number[];

    @ApiPropertyOptional({
        description: 'Дополнительные метаданные',
        example: { sectionIndex: 0, confidence: 0.95 },
    })
    @IsOptional()
    @IsObject()
    metadata?: Record<string, any>;
}

export class ProcessTextResponseDto extends BaseResponseDto {
    @ApiProperty({
        description: 'Результаты обработки текста',
        type: [EmbeddingResultDto],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => EmbeddingResultDto)
    results: EmbeddingResultDto[];

    @ApiProperty({
        description: 'Общее количество созданных секций',
        example: 3,
        minimum: 1,
    })
    @IsNumber()
    @Min(1)
    totalSections: number;

    @ApiProperty({
        description: 'Общее время обработки в миллисекундах',
        example: 1250,
    })
    @IsNumber()
    @Min(0)
    processingTime: number;

    @ApiPropertyOptional({
        description: 'Статистика обработки',
        example: {
            totalWords: 500,
            totalCharacters: 2500,
            averageSectionLength: 833,
        },
    })
    @IsOptional()
    @IsObject()
    statistics?: Record<string, any>;
}

export class ProcessBatchResponseDto extends BaseResponseDto {
    @ApiPropertyOptional({
        description:
            'Количество сохраненных векторов (если storeInDatabase: true)',
        example: 3,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    stored?: number;

    @IsOptional()
    @IsArray()
    @IsArray({ each: true })
    @IsNumber({}, { each: true })
    embeddings?: number[][];

    @ApiProperty({
        description: 'Метаданные о процессе обработки',
        example: {
            totalTexts: 3,
            averageDimensions: 384,
            processingTime: 2500,
            model: 'nomic-embed-text',
        },
    })
    @IsObject()
    metadata: {
        totalTexts: number;
        averageDimensions: number;
        processingTime: number;
        model: string;
    };
}

export class SearchResultDto {
    @ApiProperty({
        description: 'ID найденного вектора',
        example: 'uuid-5678-9012-3456',
    })
    @IsString()
    id: string;

    @ApiProperty({
        description: 'Текст найденного документа',
        example:
            'Машинное обучение - это подраздел искусственного интеллекта...',
    })
    @IsString()
    text: string;

    @ApiProperty({
        description: 'Источник документа',
        example: 'technical-docs',
    })
    @IsString()
    source: string | null;

    @ApiProperty({
        description: 'Коэффициент схожести (0-1, где 1 - полное совпадение)',
        example: 0.92,
        minimum: 0,
        maximum: 1,
    })
    @IsNumber()
    @Min(0)
    @Max(1)
    similarity: number;

    @ApiPropertyOptional({
        description: 'Метаданные документа',
        example: {
            category: 'AI',
            author: 'John Doe',
            createdAt: '2024-01-10T15:30:00Z',
        },
    })
    @IsOptional()
    @IsObject()
    metadata?: Record<string, unknown>;
}

export class SearchResponseDto extends BaseResponseDto {
    @ApiProperty({
        description: 'Поисковый запрос',
        example: 'машинное обучение',
    })
    @IsString()
    query: string;

    @ApiProperty({
        description: 'Результаты поиска',
        type: [SearchResultDto],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SearchResultDto)
    results: SearchResultDto[];

    @ApiProperty({
        description: 'Общее количество найденных результатов',
        example: 5,
    })
    @IsNumber()
    @Min(0)
    totalFound: number;

    @ApiPropertyOptional({
        description: 'Время выполнения поиска в миллисекундах',
        example: 150,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    searchTime?: number;
}

export class UpdateVectorResponseDto extends BaseResponseDto {
    @ApiProperty({
        description: 'ID обновленного вектора',
        example: 'uuid-1234-5678-9012',
    })
    @IsString()
    id: string;

    @ApiProperty({
        description: 'Подтверждение успешного обновления',
        example: true,
    })
    @IsBoolean()
    updated: boolean;

    @ApiPropertyOptional({
        description: 'Обновленные метаданные',
        example: {
            lastModified: '2024-01-15T12:00:00Z',
            version: 2,
        },
    })
    @IsOptional()
    @IsObject()
    metadata?: Record<string, any>;
}

export class DeleteVectorsResponseDto extends BaseResponseDto {
    @ApiProperty({
        description: 'Количество удаленных векторов',
        example: 25,
    })
    @IsNumber()
    @Min(0)
    deleted: number;

    @ApiPropertyOptional({
        description:
            'Источник удаленных векторов (для операций удаления по источнику)',
        example: 'old-documents',
    })
    @IsOptional()
    @IsString()
    source?: string;
}

export class SystemStatsDto {
    @ApiProperty({
        description: 'Общее количество векторов в базе',
        example: 15420,
    })
    @IsNumber()
    totalVectors: number;

    @ApiProperty({
        description: 'Количество уникальных источников',
        example: 25,
    })
    @IsNumber()
    totalSources: number;

    @ApiProperty({
        description: 'Среднее время обработки в миллисекундах',
        example: 1250,
    })
    @IsNumber()
    averageProcessingTime: number;

    @ApiProperty({
        description: 'Статистика векторизации',
        example: {
            model: 'nomic-embed-text',
            dimensions: 384,
            requestsPerMinute: 45,
        },
    })
    @IsObject()
    vectorizationStats: {
        model: string;
        dimensions: number;
        requestsPerMinute: number;
    };

    @ApiProperty({
        description: 'Статистика базы данных',
        example: {
            totalVectors: 15420,
            indexStatus: 'HEALTHY',
            responseTime: 25,
        },
    })
    @IsObject()
    databaseStats: {
        totalVectors: number;
        indexStatus: string;
        responseTime: number;
    };
}

export class StatsResponseDto extends BaseResponseDto {
    @ApiProperty({
        description: 'Статистика системы',
        type: SystemStatsDto,
    })
    @ValidateNested()
    @Type(() => SystemStatsDto)
    stats: SystemStatsDto;
}

export class HealthStatusDto {
    @ApiProperty({
        description: 'Общий статус системы',
        example: true,
    })
    @IsBoolean()
    overall: boolean;

    @ApiProperty({
        description: 'Статус сервиса векторизации',
        example: true,
    })
    @IsBoolean()
    vectorization: boolean;

    @ApiProperty({
        description: 'Статус базы данных',
        example: true,
    })
    @IsBoolean()
    database: boolean;

    @ApiPropertyOptional({
        description: 'Список ошибок (если есть)',
        example: ['Vectorization service is not responding'],
        type: [String],
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    errors?: string[];

    @ApiProperty({
        description: 'Время ответа в миллисекундах',
        example: 165,
    })
    @IsNumber()
    @Min(0)
    responseTime: number;
}

export class HealthResponseDto extends BaseResponseDto {
    @ApiProperty({
        description: 'Статус всех сервисов',
        type: HealthStatusDto,
    })
    @ValidateNested()
    @Type(() => HealthStatusDto)
    health: HealthStatusDto;
}
