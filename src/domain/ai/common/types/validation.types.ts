import { PipelineMetadata } from './common.types';

export interface InputData {
    sessionId: string;
    chatInput: string;
    metadata?: Partial<PipelineMetadata>;
}

export interface ValidationResult<T = string> {
    readonly isValid: boolean;
    readonly cleanedInput?: T;
    readonly error?: string;
    readonly metadata?: PipelineMetadata;
}

export interface ValidationConfig {
    readonly maxLength: number;
    readonly forbiddenWords: readonly string[];
    readonly cleanerRegex: RegExp;
}

export interface PreparedData {
    sessionId: string;
    input: string;
    metadata: PipelineMetadata;
    timestamp: string | undefined;
}

export interface ValidationError {
    error: string;
    sessionId: string | null;
}

export interface MessageValidationOptions {
    maxLength?: number;
    preserveCase?: boolean;
    preserveFormatting?: boolean;
    locale?: string;
}
