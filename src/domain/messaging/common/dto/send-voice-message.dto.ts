import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsNotEmpty,
    IsNumber,
    IsObject,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';

class SendVoiceMessageAudioDto {
    @ApiProperty({
        description:
            'Аудио в base64 (можно использовать data URI вида data:audio/webm;base64,...)',
        example: 'data:audio/webm;codecs=opus;base64,AAAA',
    })
    @IsString()
    @IsNotEmpty()
    base64: string;

    @ApiProperty({
        description: 'MIME-тип аудио',
        example: 'audio/webm',
    })
    @IsString()
    @IsNotEmpty()
    mimeType: string;

    @ApiProperty({
        description: 'Длительность аудио в миллисекундах',
        example: 3200,
    })
    @Type(() => Number)
    @IsNumber()
    durationMs: number;

    @ApiProperty({
        description: 'Имя исходного файла',
        example: 'voice.webm',
        required: false,
    })
    @IsString()
    @IsOptional()
    fileName?: string;

    @ApiProperty({
        description: 'Размер файла в байтах',
        example: 245998,
        required: false,
    })
    @Type(() => Number)
    @IsNumber()
    @IsOptional()
    size?: number;
}

class SendVoiceMessageBodyDto {
    @ApiProperty({
        description: 'ID чата',
        example: 'chat_123',
    })
    @IsString()
    @IsNotEmpty()
    chatId: string;

    @ApiProperty({
        description: 'Тип входящего сообщения',
        example: 'voice',
        required: false,
    })
    @IsString()
    @IsOptional()
    type?: string;

    @ApiProperty({
        description: 'Текст сообщения (опционально)',
        example: 'voice message',
        required: false,
    })
    @IsString()
    @IsOptional()
    content?: string;

    @ApiProperty({
        description: 'ID сообщения, на которое отвечает клиент',
        example: 'web_123',
        required: false,
    })
    @IsString()
    @IsOptional()
    replyToMessageId?: string;

    @ApiProperty({
        description: 'Form payload (опционально)',
        required: false,
        type: Object,
    })
    @IsObject()
    @IsOptional()
    form?: Record<string, unknown>;

    @ApiProperty({
        description: 'Голосовой payload',
        type: SendVoiceMessageAudioDto,
    })
    @ValidateNested()
    @Type(() => SendVoiceMessageAudioDto)
    audio: SendVoiceMessageAudioDto;
}

class SendVoiceMessageMetadataDto {
    @ApiProperty({
        description: 'Локаль запроса',
        example: 'ru',
        required: false,
    })
    @IsString()
    @IsOptional()
    locale?: string;

    @ApiProperty({
        description: 'Платформа источника',
        example: 'web',
        required: false,
    })
    @IsString()
    @IsOptional()
    platform?: string;

    @ApiProperty({
        description: 'Контекст страницы для SiteAssistant',
        required: false,
        type: Object,
        additionalProperties: true,
    })
    @IsObject()
    @IsOptional()
    siteAssistantContext?: Record<string, unknown>;
}

export class SendVoiceMessageDto {
    @ApiProperty({
        description: 'Envelope body',
        type: SendVoiceMessageBodyDto,
    })
    @ValidateNested()
    @Type(() => SendVoiceMessageBodyDto)
    body: SendVoiceMessageBodyDto;

    @ApiProperty({
        description: 'Envelope metadata',
        required: false,
        type: SendVoiceMessageMetadataDto,
    })
    @ValidateNested()
    @Type(() => SendVoiceMessageMetadataDto)
    @IsOptional()
    metadata?: SendVoiceMessageMetadataDto;
}
