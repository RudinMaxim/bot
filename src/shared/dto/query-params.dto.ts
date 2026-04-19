import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto, FilterDto, SortDto } from '.';

export type QueryParamsInput<T> = Partial<PaginationDto> &
    Partial<FilterDto> &
    Partial<SortDto<T>> &
    Record<string, unknown>;

export class QueryParamsDto {
    @ApiProperty({ required: false, type: PaginationDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => PaginationDto)
    pagination?: PaginationDto;

    @ApiProperty({ required: false, type: FilterDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => FilterDto)
    filter?: FilterDto;

    @ApiProperty({ required: false, type: SortDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => SortDto)
    sort?: SortDto;
}
