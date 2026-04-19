import path from 'path';
import {
    AUDIO_MIME_TYPE_MAP,
    MAX_AUDIO_FILE_SIZE_BYTES,
    SUPPORTED_AUDIO_EXTENSIONS,
    SupportedAudioExtension,
} from '../../domain/messaging/common/constants';

export interface ParsedBase64Audio {
    buffer: Buffer;
    mimeType?: string;
    fileExtension?: SupportedAudioExtension;
    sizeBytes: number;
}

export const isSupportedAudioExtension = (
    ext?: string,
): ext is SupportedAudioExtension => {
    if (!ext) return false;
    const normalized = ext.replace('.', '').toLowerCase();
    return SUPPORTED_AUDIO_EXTENSIONS.includes(
        normalized as SupportedAudioExtension,
    );
};

export const resolveAudioExtension = ({
    mimeType,
    fileName,
    fallback,
}: {
    mimeType?: string;
    fileName?: string;
    fallback?: SupportedAudioExtension;
}): SupportedAudioExtension | undefined => {
    const normalizedMime = mimeType?.toLowerCase();

    if (normalizedMime && AUDIO_MIME_TYPE_MAP[normalizedMime]) {
        return AUDIO_MIME_TYPE_MAP[normalizedMime];
    }

    if (fileName) {
        const ext = path.extname(fileName).replace('.', '').toLowerCase();
        if (isSupportedAudioExtension(ext)) {
            return ext;
        }
    }

    if (fallback && isSupportedAudioExtension(fallback)) {
        return fallback;
    }

    return undefined;
};

export const extractBase64Payload = (
    raw: string,
): { base64: string; mimeType?: string } => {
    const trimmed = raw.trim();

    if (trimmed.startsWith('data:')) {
        const commaIndex = trimmed.indexOf(',');
        if (commaIndex === -1) {
            throw new Error('Invalid data URI: missing comma separator');
        }

        const header = trimmed.slice(5, commaIndex);
        const [mimeType] = header.split(';');
        return {
            base64: trimmed.slice(commaIndex + 1).trim(),
            mimeType: mimeType || undefined,
        };
    }

    return { base64: trimmed };
};

export const decodeBase64Audio = (
    raw: string,
    mimeOverride?: string,
    sizeLimitBytes: number = MAX_AUDIO_FILE_SIZE_BYTES,
): ParsedBase64Audio => {
    const { base64, mimeType: detectedMime } = extractBase64Payload(raw);
    const buffer = Buffer.from(base64, 'base64');
    const sizeBytes = buffer.byteLength;

    if (sizeBytes === 0) {
        throw new Error('Audio payload is empty');
    }

    if (sizeBytes > sizeLimitBytes) {
        throw new Error(
            `Audio size exceeds ${Math.floor(sizeLimitBytes / (1024 * 1024))}MB`,
        );
    }

    const mimeType = mimeOverride || detectedMime;
    const fileExtension = resolveAudioExtension({
        mimeType,
    });

    return {
        buffer,
        mimeType,
        fileExtension,
        sizeBytes,
    };
};
