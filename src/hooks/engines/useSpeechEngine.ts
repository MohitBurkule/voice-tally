// Reads settings.engine and returns the matching engine's API.
// Hooks must be called unconditionally — so we always call all four and
// return only the selected one. Idle engines don't acquire mic / load models
// until their startListening is invoked, so the cost is small state slots.

import { useTally } from '../../context/TallyContext';
import { useWebSpeechEngine } from './useWebSpeechEngine';
import { useVoskEngine } from './useVoskEngine';
import { useWhisperEngine } from './useWhisperEngine';
import { useMoonshineEngine } from './useMoonshineEngine';
import type { UnifiedSpeechRecognition } from './types';

export function useSpeechEngine(): UnifiedSpeechRecognition {
  const { state } = useTally();
  const engine = state.settings.engine;

  const webspeech = useWebSpeechEngine();
  const vosk = useVoskEngine();
  const whisper = useWhisperEngine();
  const moonshine = useMoonshineEngine();

  switch (engine) {
    case 'vosk': return vosk;
    case 'whisper': return whisper;
    case 'moonshine': return moonshine;
    case 'webspeech':
    default: return webspeech;
  }
}
