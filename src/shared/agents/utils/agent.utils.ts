/**
 * Вспомогательные утилиты для агентов
 * @module agents/common
 */

import { AGENT_PRIORITY, AgentPriority } from '../types/agent.interface';

/**
 * Утилиты для валидации
 */
export class ValidationUtils {
    /**
     * Проверка на пустую строку
     */
    static isEmptyString(value: unknown): boolean {
        return typeof value !== 'string' || value.trim().length === 0;
    }

    /**
     * Проверка sessionId
     */
    static validateSessionId(sessionId: unknown): string[] {
        const errors: string[] = [];

        if (this.isEmptyString(sessionId)) {
            errors.push('SessionId is required and cannot be empty');
        }

        return errors;
    }

    /**
     * Проверка timestamp
     */
    static validateTimestamp(timestamp: unknown): string[] {
        const errors: string[] = [];

        if (!timestamp) {
            errors.push('Timestamp is required');
        }

        if (timestamp) {
            const date = new Date(timestamp as string);
            if (isNaN(date.getTime())) {
                errors.push('Invalid timestamp format');
            }
        }

        return errors;
    }

    /**
     * Проверка confidence значения
     */
    static validateConfidence(confidence: unknown): boolean {
        return (
            typeof confidence === 'number' && confidence >= 0 && confidence <= 1
        );
    }

    /**
     * Нормализация confidence из строки или числа
     */
    static normalizeConfidence(confidence: string | number): AgentPriority {
        if (typeof confidence === 'string') {
            const normalized = confidence.toLowerCase();
            if (
                normalized === AGENT_PRIORITY.HIGH ||
                normalized === AGENT_PRIORITY.MEDIUM ||
                normalized === AGENT_PRIORITY.LOW
            ) {
                return normalized;
            }
        }

        if (typeof confidence === 'number') {
            if (confidence >= 0.8) return AGENT_PRIORITY.HIGH;
            if (confidence >= 0.5) return AGENT_PRIORITY.MEDIUM;
            return AGENT_PRIORITY.LOW;
        }

        return AGENT_PRIORITY.MEDIUM;
    }
}

/**
 * Утилиты для работы с текстом
 */
export class TextUtils {
    /**
     * Экранирование строки для JSON
     */
    static escapeForJson(str: string): string {
        return str
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');
    }

    /**
     * Обрезка текста с многоточием
     */
    static truncate(text: string, maxLength: number): string {
        if (text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength - 3) + '...';
    }

    /**
     * Нормализация пробелов
     */
    static normalizeWhitespace(text: string): string {
        return text.replace(/\s+/g, ' ').trim();
    }

    /**
     * Извлечение чисел из текста
     */
    static extractNumbers(text: string): number[] {
        const matches = text.match(/\d+(?:\.\d+)?/g);
        return matches ? matches.map(Number) : [];
    }

    /**
     * Проверка на наличие email
     */
    static hasEmail(text: string): boolean {
        const emailRegex = /[^\s@]+@[^\s@]+\.[^\s@]+/;
        return emailRegex.test(text);
    }

    /**
     * Проверка на наличие телефона (российский формат)
     */
    static hasPhone(text: string): boolean {
        const phoneRegex =
            /(\+7|8|7)[\s\-()]?\d{3}[\s\-()]?\d{3}[\s\-()]?\d{2}[\s\-()]?\d{2}/;
        return phoneRegex.test(text);
    }
}

/**
 * Утилиты для работы с ошибками
 */
export class ErrorUtils {
    /**
     * Безопасное извлечение сообщения об ошибке
     */
    static extractErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }

        if (typeof error === 'string') {
            return error;
        }

        if (error && typeof error === 'object') {
            const record = error as Record<string, unknown>;
            if (typeof record.message === 'string') {
                return record.message;
            }
        }

        return 'Unknown error';
    }

    /**
     * Безопасное извлечение stack trace
     */
    static extractStackTrace(error: unknown): string | undefined {
        if (error instanceof Error && error.stack) {
            return error.stack;
        }
        return undefined;
    }

    /**
     * Проверка на таймаут ошибку
     */
    static isTimeoutError(error: unknown): boolean {
        const message = this.extractErrorMessage(error).toLowerCase();
        return message.includes('timeout') || message.includes('timed out');
    }

    /**
     * Проверка на сетевую ошибку
     */
    static isNetworkError(error: unknown): boolean {
        const message = this.extractErrorMessage(error).toLowerCase();
        return (
            message.includes('network') ||
            message.includes('econnrefused') ||
            message.includes('etimedout')
        );
    }

    /**
     * Создание структурированной ошибки
     */
    static createStructuredError(
        code: string,
        message: string,
        details?: Record<string, unknown>,
    ): Error {
        return Object.assign(new Error(message), { code, details });
    }

    static isCancellationError(error: unknown): boolean {
        if (!error) return false;
        const record =
            typeof error === 'object' && error !== null
                ? (error as Record<string, unknown>)
                : undefined;

        if (record?.name === 'AbortError') return true;
        if (record?.code === 'ERR_CANCELED') return true;
        if (record?.code === 'CANCELLED') return true;

        const message = this.extractErrorMessage(error).toLowerCase();
        return (
            message.includes('abort') ||
            message.includes('canceled') ||
            message.includes('cancelled')
        );
    }
}

/**
 * Утилиты для работы с датами
 */
export class DateUtils {
    /**
     * Форматирование даты в ISO строку
     */
    static toISOString(date?: Date): string {
        return (date || new Date()).toISOString();
    }

    /**
     * Проверка валидности даты
     */
    static isValidDate(date: unknown): boolean {
        if (!date) return false;
        const d = new Date(date as string | number | Date);
        return !isNaN(d.getTime());
    }

    /**
     * Разница между датами в миллисекундах
     */
    static diffInMs(startDate: Date, endDate: Date = new Date()): number {
        return endDate.getTime() - startDate.getTime();
    }

    /**
     * Форматирование длительности
     */
    static formatDuration(ms: number): string {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
        return `${(ms / 60000).toFixed(2)}m`;
    }
}

/**
 * Утилиты для работы с объектами
 */
export class ObjectUtils {
    /**
     * Глубокое копирование объекта
     */
    static deepClone<T>(obj: T): T {
        return JSON.parse(JSON.stringify(obj)) as T;
    }

    /**
     * Проверка на пустой объект
     */
    static isEmpty(obj: unknown): boolean {
        if (!obj || typeof obj !== 'object') return true;
        return Object.keys(obj).length === 0;
    }

    /**
     * Фильтрация null/undefined значений
     */
    static filterNullish<T extends Record<string, unknown>>(
        obj: T,
    ): Partial<T> {
        return Object.fromEntries(
            Object.entries(obj).filter(([, value]) => value != null),
        ) as Partial<T>;
    }

    /**
     * Безопасное получение вложенного свойства
     */
    static getNestedProperty<T>(
        obj: unknown,
        path: string,
        defaultValue?: T,
    ): T | undefined {
        if (!obj || typeof obj !== 'object') return defaultValue;
        const keys = path.split('.');
        let current: unknown = obj;

        for (const key of keys) {
            if (
                current == null ||
                typeof current !== 'object' ||
                !(key in current)
            ) {
                return defaultValue;
            }
            current = (current as Record<string, unknown>)[key];
        }

        return (current as T) ?? defaultValue;
    }
}

/**
 * Утилиты для retry логики
 */
export class RetryUtils {
    /**
     * Расчет задержки с экспоненциальным backoff
     */
    static calculateBackoff(
        attempt: number,
        baseDelay: number = 1000,
        maxDelay: number = 30000,
    ): number {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        // Добавляем jitter для избежания thundering herd
        const jitter = Math.random() * 0.1 * delay;
        return Math.floor(delay + jitter);
    }

    /**
     * Проверка, стоит ли повторять операцию
     */
    static shouldRetry(
        error: unknown,
        attempt: number,
        maxAttempts: number,
    ): boolean {
        if (attempt >= maxAttempts) return false;

        // Не повторяем для определенных типов ошибок
        if (ErrorUtils.isTimeoutError(error)) return true;
        if (ErrorUtils.isNetworkError(error)) return true;

        const message = ErrorUtils.extractErrorMessage(error).toLowerCase();

        // Не повторяем для валидационных ошибок
        if (message.includes('validation') || message.includes('invalid')) {
            return false;
        }

        // Не повторяем для ошибок аутентификации
        if (message.includes('unauthorized') || message.includes('forbidden')) {
            return false;
        }

        return true;
    }
}
