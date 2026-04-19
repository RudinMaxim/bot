import type { LoggerService, LogLevel } from '@nestjs/common';
import { RequestContext } from './request-context';

type LogPayload = {
    timestamp: string;
    level: LogLevel;
    message: unknown;
    context?: string;
    requestId?: string;
    trace?: string;
    pid: number;
};

const LEVEL_RANK: Record<LogLevel, number> = {
    fatal: 0,
    error: 1,
    warn: 2,
    log: 3,
    debug: 4,
    verbose: 5,
};

const normalizeLevel = (value?: string): LogLevel => {
    switch ((value || '').toLowerCase()) {
        case 'fatal':
            return 'fatal';
        case 'error':
            return 'error';
        case 'warn':
            return 'warn';
        case 'debug':
            return 'debug';
        case 'verbose':
            return 'verbose';
        case 'info':
        case 'log':
        default:
            return 'log';
    }
};

export class JsonLogger implements LoggerService {
    private readonly minLevel: LogLevel;

    constructor(level?: string) {
        this.minLevel = normalizeLevel(level);
    }

    log(message: unknown, context?: string): void {
        this.write('log', message, context);
    }

    error(message: unknown, trace?: string, context?: string): void {
        this.write('error', message, context, trace);
    }

    fatal(message: unknown, context?: string): void {
        this.write('fatal', message, context);
    }

    warn(message: unknown, context?: string): void {
        this.write('warn', message, context);
    }

    debug(message: unknown, context?: string): void {
        this.write('debug', message, context);
    }

    verbose(message: unknown, context?: string): void {
        this.write('verbose', message, context);
    }

    private shouldLog(level: LogLevel): boolean {
        return LEVEL_RANK[level] <= LEVEL_RANK[this.minLevel];
    }

    private write(
        level: LogLevel,
        message: unknown,
        context?: string,
        trace?: string,
    ): void {
        if (!this.shouldLog(level)) return;

        const payload: LogPayload = {
            timestamp: new Date().toISOString(),
            level,
            message,
            context,
            requestId: RequestContext.getRequestId(),
            trace,
            pid: process.pid,
        };

        const line = JSON.stringify(payload);
        if (level === 'error' || level === 'fatal') {
            console.error(line);
        } else if (level === 'warn') {
            console.warn(line);
        } else {
            console.log(line);
        }
    }
}
