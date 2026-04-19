import { ApiProperty } from '@nestjs/swagger';

export class ClearSessionResponseDto {
    @ApiProperty({
        example: 5,
        description: 'Количество удалённых сообщений из истории чата',
    })
    clearedMessages: number;
}
