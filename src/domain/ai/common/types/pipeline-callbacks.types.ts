import type { QuickReply } from '../../agents';
import type { OnPhaseCallback } from 'src/shared/types/processing-phase';

export interface ProgressiveResponsePayload {
    readonly quickReplies?: QuickReply[];
}

export interface ResponseChunkPayload {
    readonly chunk: string;
    readonly text: string;
}

export interface PipelineCallbacks {
    readonly onPhase?: OnPhaseCallback;
    readonly onProgressiveResponse?: (
        payload: ProgressiveResponsePayload,
    ) => void;
    readonly onResponseChunk?: (payload: ResponseChunkPayload) => void;
}
