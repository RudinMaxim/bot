import { ApiProperty } from '@nestjs/swagger';

export class QuickReplyDto {
    @ApiProperty({
        description: 'Текст, который увидит пользователь',
        example: 'Покажи похожие варианты',
    })
    text: string;

    @ApiProperty({
        description: 'Служебный intent быстрого ответа',
        example: 'explore_similar',
    })
    intent: string;

    @ApiProperty({
        description: 'Приоритет показа (меньше — выше приоритет)',
        required: false,
        example: 1,
    })
    priority?: number;

    @ApiProperty({
        description: 'Дополнительный payload для бизнес-логики',
        required: false,
        type: Object,
        additionalProperties: true,
        example: {
            apartmentId: 'apt_123',
        },
    })
    payload?: Record<string, unknown>;
}
