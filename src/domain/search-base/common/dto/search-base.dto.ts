import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsBoolean,
    IsIn,
    IsDefined,
    IsISO8601,
    IsNumber,
    IsOptional,
    IsString,
    Length,
    Max,
    Min,
    ValidateIf,
    ValidateNested,
} from 'class-validator';
import { ApiResponseDto, PaginationResponseDto } from 'src/shared/dto';
import type {
    SearchBaseDeletePayload,
    SearchBaseDeleteResult,
    SearchBaseItemDetails,
    SearchBaseItemInput,
    SearchBaseRefreshResult,
    SearchBaseSearchItem,
    SearchBaseSearchQuery,
    SearchBaseUpsertItemResult,
    SearchBaseUpsertPayload,
    SearchBaseUpsertResult,
} from '../types';
import {
    SEARCH_BASE_UPSERT_STATUS,
    type SearchBaseUpsertStatus,
} from '../constants';

export class SearchBaseItemDto implements SearchBaseItemInput {
    @ApiProperty({
        description: 'ID документа из CMS',
        example: 'cms-123',
        maxLength: 200,
        required: true,
    })
    @IsDefined()
    @IsString()
    @Length(1, 200)
    id: string;

    @ApiProperty({
        description: 'Заголовок',
        example: 'Title',
        maxLength: 500,
        required: true,
    })
    @IsString()
    @Length(1, 500)
    title: string;

    @ApiProperty({
        description: 'Краткое описание',
        example: 'Description',
        maxLength: 5000,
        required: true,
    })
    @IsString()
    @Length(1, 5000)
    description: string;

    @ApiProperty({
        description: 'Полный текст (опционально)',
        example: 'Full document content...',
        maxLength: 100000,
        required: true,
    })
    @IsDefined()
    @IsString()
    @Length(1, 100000)
    content: string;

    @ApiProperty({
        description: 'URL источника',
        example: 'https://example.com/page',
        maxLength: 2000,
        required: true,
    })
    @IsDefined()
    @IsString()
    @Length(1, 2000)
    url: string;

    @ApiPropertyOptional({
        description:
            'Дата обновления (ISO 8601). Если поле передано, оно должно содержать корректную дату.',
        example: '2025-02-05T12:34:56Z',
    })
    @ValidateIf((_, value) => value !== undefined)
    @IsString()
    @IsISO8601({
        strict: true,
        strictSeparator: true,
    })
    updatedAt?: string;

    @ApiPropertyOptional({
        description: 'Порядок в списке CMS (с 1)',
        example: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    order?: number;
}

export class SearchBaseUpsertDto implements SearchBaseUpsertPayload {
    @ApiProperty({
        description: 'Код локали',
        example: 'ru',
        maxLength: 20,
        required: true,
    })
    @IsString()
    @Length(2, 20)
    locale: string;

    @ApiProperty({
        description: 'Список документов',
        type: [SearchBaseItemDto],
        minItems: 1,
        required: true,
    })
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => SearchBaseItemDto)
    data: SearchBaseItemDto[];

    @ApiPropertyOptional({
        description: 'Пропускать, если контент не изменился',
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    skipIfUnchanged?: boolean = true;
}

export class SearchBaseQueryDto implements SearchBaseSearchQuery {
    @ApiProperty({
        description: 'Код локали',
        example: 'ru',
        maxLength: 20,
        required: true,
    })
    @IsString()
    @Length(2, 20)
    locale: string;

    @ApiPropertyOptional({
        description: 'Поисковый запрос',
        example: 'search query',
        maxLength: 768,
    })
    @IsString()
    @Length(0, 768)
    @IsOptional()
    query?: string;

    @ApiPropertyOptional({ description: 'Номер страницы', default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ description: 'Размер страницы', default: 10 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(100)
    limit?: number = 10;
}

export class SearchBaseDeleteDto implements SearchBaseDeletePayload {
    @ApiPropertyOptional({
        description: 'Код локали (обязателен, если переданы ids)',
        example: 'ru',
        maxLength: 20,
    })
    @IsOptional()
    @IsString()
    @Length(2, 20)
    locale?: string;

    @ApiPropertyOptional({
        description: 'Список ID документов',
        type: [String],
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    ids?: string[];

    @ApiPropertyOptional({
        description: 'Фильтр по источнику',
        example: 'cms',
        maxLength: 100,
    })
    @IsOptional()
    @IsString()
    @Length(1, 100)
    source?: string;

    @ApiPropertyOptional({
        description: 'Удалить документы, обновленные до (ISO 8601)',
        example: '2025-01-01T00:00:00Z',
    })
    @IsOptional()
    @IsString()
    updatedBefore?: string;
}

export class SearchBaseSearchItemDto implements SearchBaseSearchItem {
    @ApiProperty({
        description: 'ID документа',
        example: 'cms-123',
    })
    @IsString()
    id: string;

    @ApiProperty({
        description: 'Заголовок',
        example: 'Title',
    })
    @IsString()
    title: string;

    @ApiProperty({
        description: 'Описание',
        example: 'Description',
    })
    @IsString()
    description: string;

    @ApiProperty({
        description: 'Код локали',
        example: 'ru',
    })
    @IsString()
    locale: string;

    @ApiPropertyOptional({
        description: 'Источник',
        example: 'cms',
    })
    @IsOptional()
    @IsString()
    source?: string;

    @ApiPropertyOptional({
        description: 'URL',
        example: 'https://example.com/page',
    })
    @IsOptional()
    @IsString()
    url?: string;

    @ApiPropertyOptional({
        description: 'Дата обновления',
        example: '2025-02-05T12:34:56Z',
    })
    @IsOptional()
    @IsString()
    updatedAt?: string;

    @ApiPropertyOptional({
        description: 'Порядок в списке CMS (с 1)',
        example: 1,
    })
    @IsOptional()
    @IsNumber()
    order?: number;

    @ApiPropertyOptional({
        description: 'Сходство (0..1)',
        example: 0.92,
    })
    @IsOptional()
    @IsNumber()
    score?: number;
}

export class SearchBaseItemDetailsDto implements SearchBaseItemDetails {
    @ApiProperty({
        description: 'ID документа',
        example: 'cms-123',
    })
    @IsString()
    id: string;

    @ApiProperty({
        description: 'Заголовок',
        example: 'Title',
    })
    @IsString()
    title: string;

    @ApiProperty({
        description: 'Описание',
        example: 'Description',
    })
    @IsString()
    description: string;

    @ApiProperty({
        description: 'Код локали',
        example: 'ru',
    })
    @IsString()
    locale: string;

    @ApiPropertyOptional({
        description: 'Источник',
        example: 'cms',
    })
    @IsOptional()
    @IsString()
    source?: string;

    @ApiPropertyOptional({
        description: 'URL',
        example: 'https://example.com/page',
    })
    @IsOptional()
    @IsString()
    url?: string;

    @ApiPropertyOptional({
        description: 'Дата обновления',
        example: '2025-02-05T12:34:56Z',
    })
    @IsOptional()
    @IsString()
    updatedAt?: string;

    @ApiPropertyOptional({
        description: 'Дата создания',
        example: '2025-02-05T12:34:56Z',
    })
    @IsOptional()
    @IsString()
    createdAt?: string;

    @ApiPropertyOptional({
        description: 'Длина контента',
        example: 1200,
    })
    @IsOptional()
    @IsNumber()
    contentLength?: number;

    @ApiPropertyOptional({
        description: 'Количество секций',
        example: 3,
    })
    @IsOptional()
    @IsNumber()
    sectionCount?: number;

    @ApiPropertyOptional({
        description: 'Порядок в списке CMS (с 1)',
        example: 1,
    })
    @IsOptional()
    @IsNumber()
    order?: number;
}

export class SearchBaseMoveDto {
    @ApiProperty({
        description: 'Вставить после позиции (0 — в начало)',
        example: 1,
        minimum: 0,
        required: true,
    })
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    after: number;
}

export class SearchBaseUpsertItemResultDto
    implements SearchBaseUpsertItemResult
{
    @ApiProperty({
        description: 'ID документа',
        example: 'cms-123',
    })
    @IsString()
    id: string;

    @ApiProperty({
        description: 'Статус операции',
        example: 'updated',
        enum: Object.values(SEARCH_BASE_UPSERT_STATUS),
    })
    @IsIn(Object.values(SEARCH_BASE_UPSERT_STATUS))
    status: SearchBaseUpsertStatus;

    @ApiPropertyOptional({
        description: 'Причина пропуска или ошибка',
        example: 'Content is unchanged',
    })
    @IsOptional()
    @IsString()
    reason?: string;
}

export class SearchBaseUpsertResultDto implements SearchBaseUpsertResult {
    @ApiProperty({ example: 'ru' })
    @IsString()
    locale: string;

    @ApiProperty({ example: 10 })
    @IsNumber()
    processed: number;

    @ApiProperty({ example: 5 })
    @IsNumber()
    created: number;

    @ApiProperty({ example: 4 })
    @IsNumber()
    updated: number;

    @ApiProperty({ example: 1 })
    @IsNumber()
    skipped: number;

    @ApiProperty({ example: 0 })
    @IsNumber()
    failed: number;

    @ApiProperty({ type: [SearchBaseUpsertItemResultDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SearchBaseUpsertItemResultDto)
    results: SearchBaseUpsertItemResultDto[];
}

export class SearchBaseDeleteResultDto implements SearchBaseDeleteResult {
    @ApiProperty({ example: 12 })
    @IsNumber()
    deleted: number;
}

export class SearchBaseRefreshResultDto implements SearchBaseRefreshResult {
    @ApiProperty({ example: true })
    @IsBoolean()
    triggered: boolean;
}

export class ApiSearchBaseSearchResponseDto extends ApiResponseDto<
    SearchBaseSearchItemDto[]
> {
    @ApiProperty({ type: [SearchBaseSearchItemDto] })
    declare data: SearchBaseSearchItemDto[];

    @ApiProperty({ type: PaginationResponseDto, required: false })
    declare meta?: { pagination?: PaginationResponseDto };
}

export class ApiSearchBaseUpsertResponseDto extends ApiResponseDto<SearchBaseUpsertResultDto> {
    @ApiProperty({ type: SearchBaseUpsertResultDto })
    declare data: SearchBaseUpsertResultDto;
}

export class ApiSearchBaseItemResponseDto extends ApiResponseDto<SearchBaseItemDetailsDto> {
    @ApiProperty({ type: SearchBaseItemDetailsDto })
    declare data: SearchBaseItemDetailsDto;
}

export class ApiSearchBaseDeleteResponseDto extends ApiResponseDto<SearchBaseDeleteResultDto> {
    @ApiProperty({ type: SearchBaseDeleteResultDto })
    declare data: SearchBaseDeleteResultDto;
}

export class ApiSearchBaseRefreshResponseDto extends ApiResponseDto<SearchBaseRefreshResultDto> {
    @ApiProperty({ type: SearchBaseRefreshResultDto })
    declare data: SearchBaseRefreshResultDto;
}
