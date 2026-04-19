import { ApiProperty } from '@nestjs/swagger';
import { MessageStatus } from '../../common/types';
import { QuickReplyDto } from './quick-reply.dto';

export class MessageResponseDto {
    @ApiProperty({
        description: 'ID сообщения',
        example: 'msg_123',
    })
    messageId: string;

    @ApiProperty({
        description: 'Текст ответа',
        example: 'Спасибо за ваше сообщение!',
    })
    response: string;

    @ApiProperty({
        description: 'Статус обработки сообщения',
        example: MessageStatus.COMPLETED,
    })
    status: string;

    @ApiProperty({
        description: 'Быстрые ответы',
        required: false,
        type: [QuickReplyDto],
    })
    quickReplies?: QuickReplyDto[];

}
