import { DEFAULT_SUPPORTED_LOCALES } from './locales.constants';

export const SUPPORTED_LOCALES_HINT = DEFAULT_SUPPORTED_LOCALES.join(', ');
const SETTINGS_SCHEMA_EXAMPLE = {
    common: {
        mainDialog: {
            helloMessage: 'I am a chat assistant',
            secondMesage: 'Enter your request',
            options: [
                {
                    label: 'Find an apartment',
                    value: 'Help me find an apartment',
                },
                {
                    label: 'Callback request',
                    value: 'I need a callback',
                },
            ],
        },
    },
};
const LOCALE_SETTINGS_SCHEMA = {
    type: 'object',
    properties: {
        locale: { type: 'string', example: 'ru' },
        version: { type: 'string', example: 'md5:abc123' },
        lastModified: {
            type: 'string',
            format: 'date-time',
            example: '2025-02-05T12:34:56Z',
        },
        source: {
            type: 'string',
            enum: ['cache', 'fallback', 'postgres'],
            example: 'postgres',
        },
        settings: {
            type: 'object',
            example: SETTINGS_SCHEMA_EXAMPLE,
        },
    },
    required: ['locale', 'version', 'lastModified', 'source', 'settings'],
};
export const LOCALE_SETTINGS_RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'OK' },
        data: LOCALE_SETTINGS_SCHEMA,
    },
    required: ['success', 'data'],
};
export const LOCALE_SETTINGS_UPDATE_SCHEMA = {
    type: 'object',
    properties: {
        settings: {
            type: 'object',
            example: SETTINGS_SCHEMA_EXAMPLE,
        },
    },
    required: ['settings'],
};
export const LOCALES_LIST_SCHEMA = {
    type: 'object',
    properties: {
        defaultLocale: { type: 'string', example: 'ru' },
        availableLocales: {
            type: 'array',
            items: { type: 'string' },
            example: ['ru', 'en'],
        },
    },
    required: ['defaultLocale', 'availableLocales'],
};
export const LOCALES_LIST_RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'OK' },
        data: LOCALES_LIST_SCHEMA,
    },
    required: ['success', 'data'],
};
