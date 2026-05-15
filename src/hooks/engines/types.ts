// Shared interface for all speech recognition engines.
// Every engine returns this shape so the UI can swap engines without changes.

export interface DebugEvent {
  id: number;
  at: number;
  kind:
    | 'start'
    | 'result-final'
    | 'result-interim'
    | 'error'
    | 'end'
    | 'restart'
    | 'match'
    | 'reject-confidence'
    | 'reject-no-match'
    | 'watchdog'
    | 'engine'
    | 'model-load';
  detail: string;
  confidence?: number;
}

export interface UnifiedSpeechRecognition {
  isListening: boolean;
  transcript: string;
  confidence: number;
  error: string | null;
  startListening: () => void | Promise<void>;
  stopListening: () => void;
  resetTranscript: () => void;
  browserSupportsSpeechRecognition: boolean;
  debugEvents: DebugEvent[];
  clearDebugEvents: () => void;
  sessionHasAudio: boolean;
  sessionRecordingSize: number;
  downloadSessionAudio: () => void;
  clearSessionAudio: () => void;
  // Engine-specific state (model loading progress, etc).
  engineStatus?: string;
  modelLoadProgress?: number; // 0-1, or undefined if no model
  // Prefetch the engine's model weights into the browser cache so that the
  // engine can run fully offline. No-op for engines that don't have a model
  // (e.g. Web Speech).
  prefetchModel?: () => Promise<void>;
  modelCached?: boolean; // best-effort: has model finished loading at least once
}
