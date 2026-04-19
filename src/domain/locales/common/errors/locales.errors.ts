export class InvalidLocaleError extends Error {
    constructor() {
        super('Invalid locale');
        this.name = 'InvalidLocaleError';
    }
}

export class LocaleNotFoundError extends Error {
    constructor(locale: string) {
        super(`Locale not found: ${locale}`);
        this.name = 'LocaleNotFoundError';
    }
}

export class LocalePayloadError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'LocalePayloadError';
    }
}
