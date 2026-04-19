import { ApiProperty } from '@nestjs/swagger';

export class WebSocketEventPayloadFieldDto {
    @ApiProperty({
        description: 'Имя поля',
        example: 'chatId',
    })
    name: string;

    @ApiProperty({
        description: 'Тип поля',
        example: 'string',
    })
    type: string;

    @ApiProperty({
        description: 'Обязательность поля',
        example: true,
    })
    required: boolean;

    @ApiProperty({
        description: 'Описание поля',
        required: false,
        example: 'Идентификатор чата',
    })
    description?: string;

    @ApiProperty({
        description: 'Пример значения',
        required: false,
        example: 'chat_123',
    })
    example?: unknown;

    @ApiProperty({
        description: 'Возможные значения',
        type: [String],
        required: false,
        example: ['text', 'voice', 'command'],
    })
    enum?: string[];
}

export class WebSocketEventDocsDto {
    @ApiProperty({
        description: 'Имя события',
        example: 'chat_message',
    })
    event: string;

    @ApiProperty({
        description: 'Направление события',
        enum: ['client->server', 'server->client'],
        example: 'client->server',
    })
    direction: 'client->server' | 'server->client';

    @ApiProperty({
        description: 'Назначение события',
        example: 'Отправка текстового сообщения от клиента',
    })
    description: string;

    @ApiProperty({
        description: 'Пример полезной нагрузки',
        type: 'object',
        additionalProperties: true,
        example: {
            body: {
                chatId: 'chat_123',
                content: 'Привет!',
            },
            metadata: {
                locale: 'ru',
            },
        },
    })
    payloadExample: Record<string, unknown>;

    @ApiProperty({
        description:
            'Поля полезной нагрузки (dot-нотация для вложенных объектов)',
        type: () => [WebSocketEventPayloadFieldDto],
        required: false,
    })
    payloadFields?: WebSocketEventPayloadFieldDto[];

    @ApiProperty({
        description: 'Событие связано с комнатой (room) в Socket.IO',
        required: false,
        example: true,
    })
    roomScoped?: boolean;
}

export class WebSocketDocsDto {
    @ApiProperty({
        description: 'Полный endpoint WebSocket/Socket.IO',
        example: 'ws://localhost:3000/chat',
    })
    endpoint: string;

    @ApiProperty({
        description: 'Путь, на котором висит Socket.IO',
        example: '/chat',
    })
    path: string;

    @ApiProperty({
        description: 'Используемый транспорт/библиотека',
        example: 'socket.io',
    })
    transport: string;

    @ApiProperty({
        description: 'Поддерживаемые события и их полезная нагрузка',
        type: [WebSocketEventDocsDto],
    })
    events: WebSocketEventDocsDto[];

    @ApiProperty({
        description: 'Дополнительные рекомендации/ограничения',
        type: [String],
        required: false,
        example: [
            'Envelope payload: { body, metadata? }',
            'WebSocket auth по API key отключен',
        ],
    })
    notes?: string[];
}
