import {
    Body,
    Controller,
    Get,
    Header,
    Post,
    Req,
    Res,
    UseGuards,
    Version,
} from '@nestjs/common';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { SecretsConfig } from 'src/infrastructure/config/interfaces';
import { OwnsChat } from 'src/shared/security/decorators/owns-chat.decorator';
import { OwnershipGuard } from 'src/shared/security/guards/ownership.guard';
import { IdentityService } from 'src/shared/security/services/identity.service';
import { ChatOwnershipService } from 'src/shared/security/services/chat-ownership.service';
import type { Identity } from 'src/shared/security/types/identity.types';
import { MESSAGING_WIDGET_CSS } from '../common/assets/widget-css.asset';
import { MESSAGING_WIDGET_JS } from '../common/assets/widget-js.asset';
import { WidgetClearDto, WidgetMessageDto } from '../common/dto';
import { MessageStatus, MessageType } from '../common/types';
import type {
    IncomingMessage,
    MessageHistoryItem,
    ProcessedMessage,
} from '../common/types';
import { FollowUpResolverService, MessageService } from '../services';
import type { FollowUpChip } from '../services/follow-up-resolver.service';

interface WidgetRequest {
    headers: Record<string, string | string[] | undefined>;
    identity?: Identity;
}

interface WidgetSessionResponse {
    chatId: string;
    messages: MessageHistoryItem[];
}

interface WidgetMessageResponse {
    chatId: string;
    messageId: string;
    responseMessageId: string;
    response: string;
    status: MessageStatus;
    followUps: FollowUpChip[];
}

@Controller('messaging')
export class MessagingWidgetController {
    constructor(
        private readonly identityService: IdentityService,
        private readonly chatOwnership: ChatOwnershipService,
        private readonly messageService: MessageService,
        private readonly secretsConfig: SecretsConfig,
        private readonly followUpResolver: FollowUpResolverService,
    ) {}

    @Get('widget.js')
    @Version('1')
    @Header('Content-Type', 'application/javascript; charset=utf-8')
    @Header('Cache-Control', 'public, max-age=300')
    widgetScript(): string {
        return MESSAGING_WIDGET_JS;
    }

    @Get('widget.css')
    @Version('1')
    @Header('Content-Type', 'text/css; charset=utf-8')
    @Header('Cache-Control', 'public, max-age=300')
    widgetStyles(): string {
        return MESSAGING_WIDGET_CSS;
    }

    @Get('demo')
    @Version('1')
    @Header('Content-Type', 'text/html; charset=utf-8')
    @Header('Cache-Control', 'no-store')
    demoPage(): string {
        return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ФАЦ ПГМУ чат</title>
  <style>
    :root {
      color-scheme: light dark;
      font-family: Arial, sans-serif;
      background: #ffffff;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      width: 100%;
      min-width: 320px;
      height: 100%;
      margin: 0;
    }

    body {
      min-height: 100dvh;
      background: #ffffff;
    }

    #pgmu-demo-widget {
      width: 100%;
      height: 100dvh;
      min-height: 360px;
    }

    @media (prefers-color-scheme: dark) {
      :root,
      body {
        background: #15181d;
      }
    }
  </style>
</head>
<body>
  <main id="pgmu-demo-widget" aria-label="Демо чата ФАЦ ПГМУ"></main>
  <script src="./widget.js" data-container="#pgmu-demo-widget" async></script>
</body>
</html>`;
    }

    @Post('session')
    @Version('1')
    async startSession(
        @Req() req: WidgetRequest,
        @Res({ passthrough: true }) res: Response,
    ): Promise<WidgetSessionResponse> {
        const existingIdentity = this.identityService.resolve(req);
        const existingChatId = existingIdentity
            ? await this.chatOwnership.getChatIdBySession(
                  existingIdentity.sessionId,
              )
            : null;

        const issued =
            existingIdentity && existingChatId
                ? this.identityService.reissue(
                      existingIdentity.sessionId,
                      existingChatId,
                  )
                : this.identityService.issue();

        await this.chatOwnership.bind(
            issued.chatId,
            issued.sessionId,
            this.secretsConfig.security.session.cookieMaxAgeSec,
        );
        res.cookie(issued.cookieName, issued.cookieValue, issued.cookieOptions);

        const messages = await this.messageService.getMessageHistory(
            issued.chatId,
            50,
        );

        return {
            chatId: issued.chatId,
            messages,
        };
    }

    @Post('messages')
    @Version('1')
    @UseGuards(OwnershipGuard)
    @OwnsChat({ source: 'body', name: 'chatId' })
    async sendMessage(
        @Body() body: WidgetMessageDto,
        @Req() req: WidgetRequest,
    ): Promise<WidgetMessageResponse> {
        const requestMessageId = `widget_${randomUUID()}`;
        const responseMessageId = `assistant_${randomUUID()}`;
        const message = this.buildIncomingMessage(
            body,
            requestMessageId,
            req.identity?.sessionId,
        );
        const processed = await this.messageService.handleMessage(message);
        await this.messageService.saveResponseFeedbackAlias(
            body.chatId,
            requestMessageId,
            responseMessageId,
        );

        const followUps = this.followUpResolver.resolveByQuery(
            body.content,
            body.locale,
        );

        return {
            chatId: body.chatId,
            messageId: requestMessageId,
            responseMessageId,
            response: processed.response,
            status: processed.status,
            followUps,
        };
    }

    @Post('clear')
    @Version('1')
    @UseGuards(OwnershipGuard)
    @OwnsChat({ source: 'body', name: 'chatId' })
    async clear(@Body() body: WidgetClearDto): Promise<{
        chatId: string;
        clearedMessages: number;
    }> {
        const result = await this.messageService.clearSessionAndHistory(
            body.chatId,
        );
        return {
            chatId: body.chatId,
            clearedMessages: result.clearedMessages,
        };
    }

    private buildIncomingMessage(
        body: WidgetMessageDto,
        messageId: string,
        sessionId: string | undefined,
    ): IncomingMessage {
        return {
            messageId,
            chatId: body.chatId,
            userId: sessionId ?? body.chatId,
            type: MessageType.TEXT,
            content: body.content,
            timestamp: new Date(),
            metadata: {
                chatId: body.chatId,
                messageId,
                inputType: MessageType.TEXT,
                sessionId: body.chatId,
                platform: 'widget',
                userId: sessionId ?? body.chatId,
                timestamp: new Date().toISOString(),
                locale: body.locale ?? 'ru',
            },
        };
    }
}
