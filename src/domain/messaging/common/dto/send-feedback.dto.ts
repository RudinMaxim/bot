import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsString, Matches } from 'class-validator';

export class SendFeedbackDto {
    @ApiProperty({
        description: 'Ключ сообщения (формат: chatId:messageId)',
        example:
            'chat_atxdhco06:web_014fc7da-ef6e-4e2d-913b-bb14e94be537_p4ubKk3PeTBQMwg9AAAE',
    })
    @IsString()
    @IsNotEmpty()
    @Matches(/^[^:]+:.+$/, {
        message: 'key must have format chatId:messageId',
    })
    key: string;

    @ApiProperty({
        description: 'Оценка (1 — полезно, 0 — не помогло)',
        example: 1,
        enum: [0, 1],
    })
    @Type(() => Number)
    @IsIn([0, 1])
    feedback: number;
}
