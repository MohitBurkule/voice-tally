// Shared transcript→tally logic. All engines feed final transcripts here.
// Returns processTranscript(text, confidence) — handles confidence threshold,
// homophone matching, dispatch, debug events, and notification sound.

import { useCallback, useRef, useState } from 'react';
import { useTally } from '../../context/TallyContext';
import type { DebugEvent } from './types';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let sharedAudioContext: AudioContext | null = null;
const getAudioContext = (): AudioContext | null => {
  try {
    if (!sharedAudioContext) {
      const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      sharedAudioContext = new Ctor();
    }
    if (sharedAudioContext.state === 'suspended') {
      sharedAudioContext.resume().catch(() => {});
    }
    return sharedAudioContext;
  } catch {
    return null;
  }
};

export interface TranscriptProcessorAPI {
  processTranscript: (text: string, confidence: number) => void;
  pushDebug: (kind: DebugEvent['kind'], detail: string, conf?: number) => void;
  debugEvents: DebugEvent[];
  clearDebugEvents: () => void;
  // Live refs that long-lived recognizers can read without going stale.
  targetWordsRef: React.MutableRefObject<any[]>;
  confidenceThresholdRef: React.MutableRefObject<number>;
  recognitionLangRef: React.MutableRefObject<string>;
  recordSessionAudioRef: React.MutableRefObject<boolean>;
}

export function useTranscriptProcessor(): TranscriptProcessorAPI & {
  debugEventsState: DebugEvent[];
  setDebugEvents: React.Dispatch<React.SetStateAction<DebugEvent[]>>;
} {
  const { state, dispatch } = useTally();

  const targetWordsRef = useRef(state.targetWords);
  const confidenceThresholdRef = useRef(state.settings.confidenceThreshold);
  const soundEnabledRef = useRef(state.settings.soundEnabled);
  const recordSessionAudioRef = useRef(state.settings.recordSessionAudio);
  const recognitionLangRef = useRef(state.settings.recognitionLang);

  // Sync refs to live state
  targetWordsRef.current = state.targetWords;
  confidenceThresholdRef.current = state.settings.confidenceThreshold;
  soundEnabledRef.current = state.settings.soundEnabled;
  recordSessionAudioRef.current = state.settings.recordSessionAudio;
  recognitionLangRef.current = state.settings.recognitionLang;

  const [debugEvents, setDebugEvents] = useState<DebugEvent[]>([]);
  const debugIdRef = useRef(0);

  const pushDebug = useCallback(
    (kind: DebugEvent['kind'], detail: string, conf?: number) => {
      const ev: DebugEvent = {
        id: ++debugIdRef.current,
        at: Date.now(),
        kind,
        detail,
        confidence: conf,
      };
      setDebugEvents((prev: DebugEvent[]) => {
        const next = prev.length >= 50 ? prev.slice(-49) : prev;
        return [...next, ev];
      });
    },
    [setDebugEvents],
  );

  const playNotificationSound = useCallback(() => {
    if (!soundEnabledRef.current) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.frequency.setValueAtTime(1000, ctx.currentTime);
      oscillator.frequency.setValueAtTime(800, ctx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    } catch (err) {
      console.warn('Audio notification failed:', err);
    }
  }, []);

  const processTranscript = useCallback(
    (text: string, conf: number) => {
      if (!text.trim()) return;

      const threshold = confidenceThresholdRef.current;
      if (conf < threshold) {
        pushDebug(
          'reject-confidence',
          `"${text.trim()}" rejected (confidence ${conf.toFixed(2)} < threshold ${threshold.toFixed(2)})`,
          conf,
        );
        return;
      }

      const lowerText = text.toLowerCase().trim();
      let anyMatch = false;

      for (const targetWord of targetWordsRef.current) {
        const searchTerms = [
          targetWord.word.toLowerCase(),
          ...targetWord.homophones.map((h: string) => h.toLowerCase()),
        ].filter(Boolean);

        let matchedTerm: string | null = null;
        let matchCount = 0;

        for (const term of searchTerms) {
          const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, 'gi');
          const matches = lowerText.match(regex);
          if (matches?.length) {
            matchedTerm = term;
            matchCount = matches.length;
            break;
          }
        }

        if (!matchedTerm) continue;
        anyMatch = true;

        pushDebug(
          'match',
          `"${matchedTerm}" matched "${targetWord.word}" x${matchCount}`,
          conf,
        );

        for (let i = 0; i < matchCount; i++) {
          playNotificationSound();
          dispatch({
            type: 'INCREMENT_WORD',
            payload: {
              wordId: targetWord.id,
              detectedWord: matchedTerm,
            },
          });
        }
      }

      if (!anyMatch) {
        pushDebug('reject-no-match', `"${text.trim()}" — no target word`, conf);
      }
    },
    [dispatch, playNotificationSound, pushDebug],
  );

  const clearDebugEvents = useCallback(() => setDebugEvents([]), [setDebugEvents]);

  return {
    processTranscript,
    pushDebug,
    debugEvents,
    debugEventsState: debugEvents,
    setDebugEvents,
    clearDebugEvents,
    targetWordsRef,
    confidenceThresholdRef,
    recognitionLangRef,
    recordSessionAudioRef,
  };
}
