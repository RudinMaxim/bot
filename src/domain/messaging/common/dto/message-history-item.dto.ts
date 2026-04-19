import { ApiProperty } from '@nestjs/swagger';
import { MessageType } from '../../common/types';
import { QuickReplyDto } from './quick-reply.dto';

export class MessageHistoryItemDto {
    @ApiProperty({
        description: 'ID сообщения',
        example: 'msg_123456789',
        required: false,
    })
    messageId?: string;

    @ApiProperty({
        description: 'Текст сообщения',
        example: 'Привет, как дела?',
        required: false,
    })
    content?: string;

    @ApiProperty({
        description: 'Временная метка сообщения',
        example: '2023-11-02T12:00:00.000Z',
        required: false,
    })
    timestamp?: string | number | Date;

    @ApiProperty({
        description: 'Тип сообщения',
        enum: MessageType,
        example: MessageType.TEXT,
        required: false,
    })
    type?: MessageType;

    @ApiProperty({
        description: 'Предложенные быстрые ответы',
        required: false,
        type: [QuickReplyDto],
    })
    quickReplies?: Array<string | QuickReplyDto>;

    @ApiProperty({
        description: 'Выбранный быстрый ответ',
        required: false,
        oneOf: [
            { type: 'string' },
            { $ref: '#/components/schemas/QuickReplyDto' },
        ],
    })
    selectedQuickReply?: string | QuickReplyDto;

    @ApiProperty({
        description: 'Аудио payload сообщения',
        required: false,
        type: Object,
    })
    audio?: Record<string, unknown>;

    @ApiProperty({
        description: 'Оценка ответа (1 — полезно, 0 — не помогло)',
        required: false,
        example: 1,
    })
    feedbackValue?: number;

    @ApiProperty({
        description: 'Время отправки отзыва',
        required: false,
        example: '2025-12-09T10:20:30.000Z',
    })
    feedbackTimestamp?: string | number | Date;
}
