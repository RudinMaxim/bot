import { IncomingMessage, MessageType } from '../types';
import {
    extractRecognitionTimeMs,
    resolveAiMessageData,
} from '../utils/message-processing.util';

describe('message-processing.util', () => {
    const BASE_MESSAGE: IncomingMessage = {
        messageId: 'm-1',
        chatId: 'chat-1',
        userId: 'user-1',
        type: MessageType.VOICE,
        content: '[voice_message]',
        rawContent: Buffer.from('abc'),
        timestamp: new Date('2026-01-01T10:00:00.000Z'),
        metadata: {
            platform: 'web',
            mimeType: 'audio/ogg',
            fileName: 'voice.ogg',
            fileSize: 3,
        },
    };

    it('maps AI payload and keeps rich quick reply metadata without visuals', () => {
        const mapped = resolveAiMessageData(
            {
                sessionId: 'chat-1',
                timestamp: '2026-01-01T10:00:00.000Z',
                success: true,
                mode: 'answer',
                response: '',
                confidence: 'medium',
                metrics: {
                    executionTime: 10,
                    inputTokens: 0,
                    outputTokens: 0,
                    totalTokens: 0,
                },
                metadata: {
                    executionTime: 10,
                    agentsProcessed: 1,
                    searchResultsCount: 0,
                    analysisResultsCount: 0,
                    hasUrl: false,
                    coordinatorConfidence: 0.8,
                    quickReplies: [
                        {
                            text: ' show_catalog ',
                            intent: 'continue_search',
                            priority: 1,
                            payload: {
                                excludePropertyIds: ['1', '2'],
                            },
                        },
                    ],
                },
                quickReplies: [],
            },
            'fallback',
        );

        expect(mapped.response).toBe('fallback');
        expect(mapped.quickReplies).toEqual([
            {
                text: 'show_catalog',
                intent: 'continue_search',
                priority: 1,
                payload: {
                    excludePropertyIds: ['1', '2'],
                },
            },
        ]);
        expect(mapped).not.toHaveProperty('visuals');
    });

    it('extracts recognition time with primary and fallback field', () => {
        expect(extractRecognitionTimeMs({ recognitionTimeMs: 50 })).toBe(50);
        expect(extractRecognitionTimeMs({ recognitionTime: 75 })).toBe(75);
        expect(extractRecognitionTimeMs({})).toBeUndefined();
    });
});
