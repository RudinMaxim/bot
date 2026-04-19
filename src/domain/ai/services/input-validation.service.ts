import { Injectable, Logger } from '@nestjs/common';
import {
    ValidationConfig,
    InputData,
    PreparedData,
    ValidationResult,
    ValidationError,
    MessageValidationOptions,
    PipelineMetadata,
    Role,
} from '../common/types';
import { resolveLocale, t } from 'src/shared/utils';
import {
    VALID_NAME_RE,
    EMAIL_RE,
    PHONE_SEPARATORS_RE,
    PHONE_RE,
    SCRIPT_RE,
    IFRAME_RE,
    JS_PROTOCOL_RE,
    INLINE_HANDLER_RE,
    ZERO_WIDTH_RE,
} from '../common/constants/regx.constants';

const TRUNCATION = {
    SENTENCE_BOUNDARY: 0.7,
    WORD_BOUNDARY: 0.8,
} as const;

@Injectable()
export class InputValidationService {
    private readonly logger = new Logger(InputValidationService.name);

    private readonly config: ValidationConfig = {
        maxLength: 768,
        forbiddenWords: ['script', 'eval', 'javascript', 'alert'] as const,
        cleanerRegex:
            /(```[\s\S]*?```|`[^`]*`|<[^>]*>|[\u200B-\u200D\uFEFF]|[^\p{L}\p{N}\p{P}\p{Zs}])/gu,
    };

    validateInput(data: InputData): ValidationResult {
        const locale = resolveLocale(data.metadata?.locale);
        try {
            const validationError = this.checkRequiredFields(data, locale);
            if (validationError) {
                return { isValid: false, error: validationError };
            }

            const cleanedInput = this.sanitizeInput(data.chatInput);

            if (cleanedInput.length === 0) {
                return {
                    isValid: false,
                    error: t(
                        'system.ai.validation.inputEmptyAfterSanitization',
                        undefined,
                        locale,
                    ),
                };
            }

            const metadata: PipelineMetadata = {
                ...data.metadata,
                originalLength: data.chatInput.length,
                cleanedLength: cleanedInput.length,
                timestamp: new Date().toISOString(),
                originalInput: data.chatInput,
            };

            return {
                isValid: true,
                cleanedInput,
                metadata,
            };
        } catch (error) {
            this.logger.error('Validation error:', error);
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : t(
                          'system.ai.validation.validationFailedFallback',
                          undefined,
                          locale,
                      );
            return {
                isValid: false,
                error: t(
                    'system.ai.validation.validationFailed',
                    { error: errorMessage },
                    locale,
                ),
            };
        }
    }

    validateMessage(
        content: string,
        role: Role,
        options: MessageValidationOptions = {},
    ): { isValid: boolean; cleaned: string; error?: string } {
        const { maxLength = 8000, preserveCase = true } = options;
        const locale = resolveLocale(options.locale);

        try {
            if (!content || typeof content !== 'string') {
                return {
                    isValid: false,
                    cleaned: '',
                    error: t(
                        'system.ai.validation.contentMustBeString',
                        undefined,
                        locale,
                    ),
                };
            }

            let cleaned = content.trim();

            cleaned = this.removeDangerousPatterns(cleaned);

            cleaned = cleaned.replace(/\s{3,}/g, '  ');

            if (cleaned.length > maxLength) {
                this.logger.warn(
                    `Message truncated from ${cleaned.length} to ${maxLength} chars`,
                );
                cleaned = this.truncateAtSentence(cleaned, maxLength);
            }

            if (!preserveCase && role === 'user') {
                cleaned = cleaned.toLowerCase();
            }

            if (cleaned.length === 0) {
                return {
                    isValid: false,
                    cleaned: '',
                    error: t(
                        'system.ai.validation.contentEmptyAfterSanitization',
                        undefined,
                        locale,
                    ),
                };
            }

            return { isValid: true, cleaned };
        } catch (error) {
            this.logger.error('Message validation error:', error);
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : t(
                          'system.ai.validation.validationFailedFallback',
                          undefined,
                          locale,
                      );
            return {
                isValid: false,
                cleaned: '',
                error: t(
                    'system.ai.validation.validationFailed',
                    { error: errorMessage },
                    locale,
                ),
            };
        }
    }

    validateContactInfo(
        name?: string,
        phone?: string,
        email?: string,
        contactInfo?: string,
        locale?: string,
    ): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];
        const resolvedLocale = resolveLocale(locale);

        if (name) {
            const cleanName = name.trim();
            if (cleanName.length === 0) {
                errors.push(
                    t(
                        'system.ai.validation.nameCannotBeEmpty',
                        undefined,
                        resolvedLocale,
                    ),
                );
            } else if (cleanName.length > 100) {
                errors.push(
                    t(
                        'system.ai.validation.nameTooLong',
                        undefined,
                        resolvedLocale,
                    ),
                );
            } else if (!VALID_NAME_RE.test(cleanName)) {
                errors.push(
                    t(
                        'system.ai.validation.nameInvalidChars',
                        undefined,
                        resolvedLocale,
                    ),
                );
            }
        }

        if (phone) {
            const contact = phone.trim();
            const cleanPhone = contact.replace(PHONE_SEPARATORS_RE, '');
            if (!PHONE_RE.test(cleanPhone)) {
                errors.push(
                    t(
                        'system.ai.validation.invalidContactFormat',
                        undefined,
                        resolvedLocale,
                    ),
                );
            }
        }

        if (email) {
            const normalizedEmail = email.trim().toLowerCase();
            if (!EMAIL_RE.test(normalizedEmail)) {
                errors.push(
                    t(
                        'system.ai.validation.invalidContactFormat',
                        undefined,
                        resolvedLocale,
                    ),
                );
            }
        }

        if (contactInfo && !phone && !email) {
            const contact = contactInfo.trim();
            const isEmail = EMAIL_RE.test(contact);
            if (!isEmail) {
                const cleanPhone = contact.replace(PHONE_SEPARATORS_RE, '');
                if (!PHONE_RE.test(cleanPhone)) {
                    errors.push(
                        t(
                            'system.ai.validation.invalidContactFormat',
                            undefined,
                            resolvedLocale,
                        ),
                    );
                }
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    }

    validateAndPrepareData(
        items: InputData[],
    ): (PreparedData | ValidationError)[] {
        return items.map((item): PreparedData | ValidationError => {
            const validation = this.validateInput(item);

            if (!validation.isValid) {
                return {
                    error: validation.error!,
                    sessionId: item.sessionId ?? null,
                };
            }

            return {
                sessionId: item.sessionId,
                input: validation.cleanedInput!,
                metadata: validation.metadata!,
                timestamp: validation.metadata!.timestamp,
            };
        });
    }

    private checkRequiredFields(
        data: InputData,
        locale: ReturnType<typeof resolveLocale>,
    ): string | null {
        if (!data.sessionId?.trim()) {
            return t(
                'system.ai.validation.sessionIdRequired',
                undefined,
                locale,
            );
        }

        if (!data.chatInput?.trim()) {
            return t(
                'system.ai.validation.chatInputRequired',
                undefined,
                locale,
            );
        }

        return null;
    }

    private sanitizeInput(input: string): string {
        let sanitized = input.replace(this.config.cleanerRegex, '');

        this.config.forbiddenWords.forEach((word) => {
            const regex = new RegExp(`\\b${word}\\b(?:\\s*\\([^)]*\\))?`, 'gi');
            sanitized = sanitized.replace(regex, '');
        });

        sanitized = sanitized.trim().replace(/\s{2,}/g, ' ');

        if (sanitized.length > this.config.maxLength) {
            sanitized = sanitized.slice(0, this.config.maxLength);
            this.logger.warn(
                `Input truncated to ${this.config.maxLength} characters`,
            );
        }

        return sanitized.toLowerCase();
    }

    private removeDangerousPatterns(text: string): string {
        return text
            .replace(SCRIPT_RE, '')
            .replace(IFRAME_RE, '')
            .replace(JS_PROTOCOL_RE, '')
            .replace(INLINE_HANDLER_RE, '')
            .replace(ZERO_WIDTH_RE, '');
    }

    private truncateAtSentence(text: string, maxLength: number): string {
        if (text.length <= maxLength) return text;

        const truncated = text.slice(0, maxLength);
        const lastSentenceEnd = Math.max(
            truncated.lastIndexOf('.'),
            truncated.lastIndexOf('!'),
            truncated.lastIndexOf('?'),
        );

        if (lastSentenceEnd > maxLength * TRUNCATION.SENTENCE_BOUNDARY) {
            return truncated.slice(0, lastSentenceEnd + 1).trim();
        }

        const lastSpace = truncated.lastIndexOf(' ');
        if (lastSpace > maxLength * TRUNCATION.WORD_BOUNDARY) {
            return truncated.slice(0, lastSpace).trim() + '...';
        }

        return truncated.trim() + '...';
    }
}
