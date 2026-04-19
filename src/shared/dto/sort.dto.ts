import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum SortOrder {
    ASC = 'asc',
    DESC = 'desc',
}

export class SortDto<T = any> {
    @ApiProperty({ required: false, enum: SortOrder, default: SortOrder.ASC })
    @IsOptional()
    @IsEnum(SortOrder)
    order: SortOrder = SortOrder.ASC;

    @ApiProperty({ required: false, example: 'createdAt' })
    @IsOptional()
    @IsString()
    field?: T;
}
