import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsIn,
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength,
} from 'class-validator';

export class SendTtsRequestDto {
    @ApiProperty({
        description: 'Текст для синтеза речи',
        example: 'Здравствуйте, чем могу помочь?',
        maxLength: 5000,
    })
    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim() : value,
    )
    @IsString()
    @IsNotEmpty()
    @MaxLength(5000)
    text: string;

    @ApiPropertyOptional({
        description: 'Язык синтеза',
        example: 'ru',
        enum: ['ru', 'en'],
    })
    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim().toLowerCase() : value,
    )
    @IsString()
    @IsIn(['ru', 'en'])
    @IsOptional()
    lang?: 'ru' | 'en';
}
