export const ProcessingPhase = {
    THINKING: 'thinking',
    SEARCHING: 'searching',
    ANALYZING: 'analyzing',
    EXECUTING: 'executing',
    NAVIGATING: 'navigating',
    RESULTS: 'results',
    GENERATING: 'generating',
    STREAMING: 'streaming',
} as const;

export type ProcessingPhase =
    (typeof ProcessingPhase)[keyof typeof ProcessingPhase];

export type OnPhaseCallback = (phase: ProcessingPhase) => void;
