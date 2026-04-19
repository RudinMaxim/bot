import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export type FilterOperator =
    | 'eq' // equals - равно
    | 'ne' // not equals - не равно
    | 'gt' // greater than - больше чем
    | 'lt' // less than - меньше чем
    | 'gte' // greater than or equal - больше или равно
    | 'lte' // less than or equal - меньше или равно
    | 'in' // in array - значение находится в массиве
    | 'nin' // not in array - значение не находится в массиве
    | 'like'; // contains substring - содержит подстроку

export const validOperators: FilterOperator[] = [
    'eq',
    'ne',
    'gt',
    'lt',
    'gte',
    'lte',
    'in',
    'nin',
    'like',
];

export type FilterValue =
    | string
    | number
    | boolean
    | Date
    | Array<string | number | boolean | Date>;

export type FilterKeyFields = string | number | symbol;

export interface FieldOperator {
    [operator: string]: string;
}

export interface FieldsFilter {
    [fieldName: string]: FieldOperator;
}

export class FilterFieldDto {
    @ApiProperty({ required: false, example: 'eq' })
    @IsOptional()
    @IsString()
    operator?: FilterOperator;

    @ApiProperty({ required: false })
    @IsOptional()
    value?: FilterValue;
}

export class SearchDto {
    @ApiProperty({ required: false, example: 'search term' })
    @IsOptional()
    @IsString()
    search?: string;
}

export class FilterDto extends SearchDto {
    @ApiProperty({
        required: false,
        additionalProperties: {
            type: 'object',
            properties: {
                operator: { type: 'string' },
                value: { type: 'string' },
            },
        },
        example: { name: { operator: 'like', value: 'John' } },
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => FilterFieldDto)
    fields?: Record<FilterKeyFields, FilterFieldDto>;
}
