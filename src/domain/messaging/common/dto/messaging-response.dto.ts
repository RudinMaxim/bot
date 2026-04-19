import { ApiProperty } from '@nestjs/swagger';
import { ApiResponseDto } from 'src/shared/dto';
import { ClearSessionResponseDto } from './clear-session-response.dto';
import { MessageHistoryItemDto } from './message-history-item.dto';
import { MessageResponseDto } from './message-response.dto';
import { WebSocketDocsDto } from './websocket-docs.dto';

export class FeedbackResponseDto {
    @ApiProperty({ example: true })
    saved: boolean;
}

export class MessageHistoryResponseDto {
    @ApiProperty({ type: [MessageHistoryItemDto] })
    messages: MessageHistoryItemDto[];
}

export class ApiMessageResponseDto extends ApiResponseDto<MessageResponseDto> {
    @ApiProperty({ type: MessageResponseDto })
    declare data: MessageResponseDto;
}

export class ApiFeedbackResponseDto extends ApiResponseDto<FeedbackResponseDto> {
    @ApiProperty({ type: FeedbackResponseDto })
    declare data: FeedbackResponseDto;
}

export class ApiClearSessionResponseDto extends ApiResponseDto<ClearSessionResponseDto> {
    @ApiProperty({ type: ClearSessionResponseDto })
    declare data: ClearSessionResponseDto;
}

export class ApiWebSocketDocsResponseDto extends ApiResponseDto<WebSocketDocsDto> {
    @ApiProperty({ type: WebSocketDocsDto })
    declare data: WebSocketDocsDto;
}
