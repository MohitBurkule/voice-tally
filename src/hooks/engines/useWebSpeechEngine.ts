// Adapter: existing useAdvancedSpeechRecognition exposed via the unified
// engine interface. No behavior change — just wraps the return shape.

import { useAdvancedSpeechRecognition } from '../useAdvancedSpeechRecognition';
import type { UnifiedSpeechRecognition } from './types';

export function useWebSpeechEngine(): UnifiedSpeechRecognition {
  const api = useAdvancedSpeechRecognition();
  return {
    ...api,
    engineStatus: api.isListening ? 'listening' : 'idle',
    modelLoadProgress: undefined,
  };
}
