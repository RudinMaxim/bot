import {
    classifySpeechRecognitionError,
    isRetryableStatus,
} from '../utils/speech-recognition-error.util';

describe('speech-recognition-error.util', () => {
    it('maps auth errors by status', () => {
        const error = classifySpeechRecognitionError({
            status: 401,
            rawMessage: 'Unauthorized',
        });

        expect(error).toEqual({
            code: 'AUTH_ERROR',
            message: 'OpenRouter API authentication failed',
            retryable: false,
        });
    });

    it('maps network errors by message pattern', () => {
        const error = classifySpeechRecognitionError({
            rawMessage: 'socket hang up',
            fallbackMessage: 'socket hang up',
        });

        expect(error).toEqual({
            code: 'NETWORK_ERROR',
            message: 'Temporary network or OpenRouter service error',
            retryable: true,
        });
    });

    it('keeps fallback message for unknown errors', () => {
        const error = classifySpeechRecognitionError({
            status: 418,
            rawMessage: 'custom unknown',
            fallbackMessage: 'custom unknown',
        });

        expect(error).toEqual({
            code: 'TRANSCRIPTION_FAILED',
            message: 'custom unknown',
            retryable: false,
        });
    });

    it('returns retryable for known retry status', () => {
        expect(isRetryableStatus(503)).toBe(true);
        expect(isRetryableStatus(400)).toBe(false);
    });
});
