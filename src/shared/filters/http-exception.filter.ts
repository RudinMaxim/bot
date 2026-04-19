import {
    Catch,
    ExceptionFilter,
    HttpException,
    ArgumentsHost,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiResponseDto } from '../../shared/dto';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: HttpException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const status = exception.getStatus();
        const exceptionResponse = exception.getResponse();

        let errors: { code: string; details: string }[] = [];

        if (exceptionResponse && typeof exceptionResponse === 'object') {
            const { code, details, message } = exceptionResponse as any;

            const messages: string[] = Array.isArray(details || message)
                ? details || message
                : [details || message || exception.message];

            errors = messages.map((msg) => ({
                code: code || exception.name || 'UNKNOWN_ERROR',
                details: msg || 'Unexpected error',
            }));
        } else {
            errors = [
                {
                    code: exception.name || 'UNKNOWN_ERROR',
                    details: exception.message || 'Internal server error',
                },
            ];
        }

        const errorResponse: ApiResponseDto<null> = {
            success: false,
            message: exception.message || 'Unexpected error',
            data: null,
            error: errors,
        };

        response.status(status).json(errorResponse);
    }
}
