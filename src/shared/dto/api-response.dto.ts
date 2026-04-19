import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { PaginationResponseDto } from './pagination.dto';

export class ApiResponseErrorDto {
    @ApiProperty({ example: 'USER_NOT_FOUND' })
    code: string;

    @ApiProperty({ example: 'Пользователь не найден' })
    details: string;
}

export class ApiResponseMetaDto {
    @ApiProperty({
        type: PaginationResponseDto,
        required: false,
    })
    @ValidateNested()
    @Type(() => PaginationResponseDto)
    @IsOptional()
    pagination?: PaginationResponseDto;
}

export class ApiResponseDto<T = any> {
    @ApiProperty({ example: true })
    success: boolean;

    @ApiProperty({ example: 'Operation successful', required: false })
    message?: string;

    @ApiProperty({ required: false })
    data?: T | null;

    @ApiProperty({
        type: () => ApiResponseMetaDto,
        required: false,
    })
    @ValidateNested()
    @Type(() => ApiResponseMetaDto)
    @IsOptional()
    meta?: ApiResponseMetaDto;

    @ApiProperty({
        type: [ApiResponseErrorDto],
        example: null,
        required: false,
    })
    error?: ApiResponseErrorDto[];
}

export class ApiErrorResponseDto extends ApiResponseDto<null> {
    @ApiProperty({ example: false })
    declare success: boolean;

    @ApiProperty({ example: null, nullable: true })
    declare data: null;

    @ApiProperty({
        type: [ApiResponseErrorDto],
        required: false,
    })
    declare error?: ApiResponseErrorDto[];
}
