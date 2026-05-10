import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export type WidgetLocale = 'ru' | 'en';

export class WidgetMessageDto {
    @IsString()
    @MinLength(1)
    @MaxLength(128)
    chatId!: string;

    @IsString()
    @MinLength(1)
    @MaxLength(4000)
    content!: string;

    @IsOptional()
    @IsIn(['ru', 'en'])
    locale?: WidgetLocale;
}

export class WidgetClearDto {
    @IsString()
    @MinLength(1)
    @MaxLength(128)
    chatId!: string;
}
