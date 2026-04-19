import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export abstract class BaseResponseDto {
    @ApiProperty({
        description: 'Статус выполнения операции',
        example: true,
    })
    @IsBoolean()
    success: boolean;

    @ApiProperty({
        description: 'Сообщение об ошибке (если success: false)',
        example: 'Validation failed',
        required: false,
    })
    @IsOptional()
    @IsString()
    message?: string;
}

export abstract class BaseRequestDto {
    @ApiProperty({
        description: 'Идентификатор источника данных',
        example: 'user-documents',
        minLength: 1,
        maxLength: 100,
    })
    @IsString()
    source: string;

    @ApiProperty({
        description: 'Дополнительные метаданные',
        example: {
            userId: '12345',
            documentType: 'article',
            category: 'technology',
            language: 'ru',
        },
        required: false,
    })
    @IsOptional()
    metadata?: Record<string, any>;
}
