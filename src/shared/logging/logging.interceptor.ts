import {
    Injectable,
    Logger,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger('Http');

    intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Observable<unknown> {
        if (context.getType() !== 'http') {
            return next.handle();
        }

        const http = context.switchToHttp();
        const request = http.getRequest<Request>();
        const response = http.getResponse<Response>();
        const start = Date.now();

        return next.handle().pipe(
            tap({
                next: () => {
                    this.logger.log({
                        method: request.method,
                        path: request.originalUrl || request.url,
                        statusCode: response.statusCode,
                        durationMs: Date.now() - start,
                    });
                },
                error: (error) => {
                    this.logger.error(
                        {
                            method: request.method,
                            path: request.originalUrl || request.url,
                            statusCode: response.statusCode,
                            durationMs: Date.now() - start,
                            error:
                                error instanceof Error ? error.message : error,
                        },
                        error instanceof Error ? error.stack : undefined,
                    );
                },
            }),
        );
    }
}
