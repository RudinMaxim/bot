export const SUPPORTED_AUDIO_EXTENSIONS = [
    'ogg',
    'oga',
    'mp3',
    'wav',
    'webm',
    'm4a',
] as const;

export type SupportedAudioExtension =
    (typeof SUPPORTED_AUDIO_EXTENSIONS)[number];

export const AUDIO_MIME_TYPE_MAP: Record<string, SupportedAudioExtension> = {
    'audio/ogg': 'ogg',
    'audio/oga': 'oga',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/webm': 'webm',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
};

export const MAX_AUDIO_FILE_SIZE_BYTES = 25 * 1024 * 1024;
