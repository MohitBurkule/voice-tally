
import { useState, useRef, useCallback, useEffect } from 'react';
import { useTally } from '../context/TallyContext';

export interface DebugEvent {
  id: number;
  at: number;
  kind: 'start' | 'result-final' | 'result-interim' | 'error' | 'end' | 'restart' | 'match' | 'reject-confidence' | 'reject-no-match' | 'watchdog';
  detail: string;
  confidence?: number;
}

interface UseAdvancedSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  confidence: number;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  browserSupportsSpeechRecognition: boolean;
  debugEvents: DebugEvent[];
  clearDebugEvents: () => void;
  sessionHasAudio: boolean;
  sessionRecordingSize: number;
  downloadSessionAudio: () => void;
  clearSessionAudio: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// Singleton AudioContext — reused across beep calls
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

export function useAdvancedSpeechRecognition(): UseAdvancedSpeechRecognitionReturn {
  const { state, dispatch } = useTally();
  const [transcript, setTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persistent refs across renders + recognition cycles
  const recognitionRef = useRef<any>(null);
  // Pre-warmed next instance — constructed in advance so the swap on onend
  // is just a .start() call, eliminating construction time from the gap.
  const nextRecognitionRef = useRef<any>(null);
  const recognitionEndedAtRef = useRef<number>(0);
  const restartCountRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  // Session chunks: accumulated for the entire listening session — never trimmed.
  // Used to build a downloadable recording.
  const sessionChunksRef = useRef<Blob[]>([]);
  const sessionMimeRef = useRef<string>('audio/webm');
  const sessionStartedAtRef = useRef<number>(0);
  const [sessionRecordingSize, setSessionRecordingSize] = useState(0);
  const [sessionHasAudio, setSessionHasAudio] = useState(false);
  const isActiveRef = useRef(false);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdogTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef('');
  const errorRef = useRef<string | null>(null);
  const lastResultAtRef = useRef<number>(0);
  const restartAttemptsRef = useRef(0);
  const historyCounterRef = useRef(0);

  // Debug event ring buffer (last 50 events) for the debug panel
  const [debugEvents, setDebugEvents] = useState<DebugEvent[]>([]);
  const debugIdRef = useRef(0);
  const pushDebug = useCallback((kind: DebugEvent['kind'], detail: string, conf?: number) => {
    const ev: DebugEvent = {
      id: ++debugIdRef.current,
      at: Date.now(),
      kind,
      detail,
      confidence: conf,
    };
    setDebugEvents(prev => {
      const next = prev.length >= 50 ? prev.slice(-49) : prev;
      return [...next, ev];
    });
  }, []);

  // Live refs for state values used inside long-lived recognition callbacks.
  // Without these, the active recognition instance closes over stale state.
  const targetWordsRef = useRef(state.targetWords);
  const confidenceThresholdRef = useRef(state.settings.confidenceThreshold);
  const soundEnabledRef = useRef(state.settings.soundEnabled);

  useEffect(() => { targetWordsRef.current = state.targetWords; }, [state.targetWords]);
  useEffect(() => { confidenceThresholdRef.current = state.settings.confidenceThreshold; }, [state.settings.confidenceThreshold]);
  useEffect(() => { soundEnabledRef.current = state.settings.soundEnabled; }, [state.settings.soundEnabled]);

  const browserSupportsSpeechRecognition = !!(
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)
  );

  const setErrorWithRef = useCallback((msg: string | null) => {
    errorRef.current = msg;
    setError(msg);
    dispatch({ type: 'SET_ERROR', payload: msg });
  }, [dispatch]);

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

  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const processTranscript = useCallback((text: string, conf: number) => {
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
        ...targetWord.homophones.map(h => h.toLowerCase()),
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

      const audioBlob = audioChunksRef.current.length > 0
        ? new Blob(audioChunksRef.current, { type: 'audio/webm' })
        : undefined;

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
            audioBlob,
          },
        });
      }
    }

    if (!anyMatch) {
      pushDebug('reject-no-match', `"${text.trim()}" — no target word`, conf);
    }

    // Trim audio chunks to avoid unbounded growth across long sessions
    if (audioChunksRef.current.length > 50) {
      audioChunksRef.current = audioChunksRef.current.slice(-25);
    }
  }, [dispatch, playNotificationSound, pushDebug]);

  // Audio recording lives at the user-session level — start once on user start,
  // stop once on user stop. Not cycled per recognition restart.
  const startAudioRecording = useCallback(async () => {
    if (mediaRecorderRef.current?.state === 'recording') return;
    if (!navigator.mediaDevices?.getUserMedia) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        },
      });
      micStreamRef.current = stream;

      const mimeCandidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
      ];
      const mimeType = mimeCandidates.find(m => {
        try { return (window as any).MediaRecorder?.isTypeSupported?.(m); } catch { return false; }
      });

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      sessionChunksRef.current = [];
      sessionMimeRef.current = mediaRecorder.mimeType || mimeType || 'audio/webm';
      sessionStartedAtRef.current = Date.now();
      setSessionRecordingSize(0);
      setSessionHasAudio(false);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          sessionChunksRef.current.push(event.data);
          setSessionRecordingSize(s => s + event.data.size);
          setSessionHasAudio(true);
        }
      };

      mediaRecorder.start(250);
      dispatch({ type: 'SET_RECORDING', payload: true });
    } catch (err) {
      console.error('Audio recording failed:', err);
      setErrorWithRef(`Microphone access failed: ${err}`);
    }
  }, [dispatch, setErrorWithRef]);

  const stopAudioRecording = useCallback(() => {
    try {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    } catch (_) {}
    try {
      micStreamRef.current?.getTracks().forEach(track => track.stop());
    } catch (_) {}
    mediaRecorderRef.current = null;
    micStreamRef.current = null;
    audioChunksRef.current = [];
    dispatch({ type: 'SET_RECORDING', payload: false });
  }, [dispatch]);

  // Forward declaration so onend can call into restart
  const restartRecognitionRef = useRef<() => void>(() => {});

  const createRecognitionInstance = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      restartAttemptsRef.current = 0;
      const now = Date.now();
      lastResultAtRef.current = now;
      setIsListening(true);
      setErrorWithRef(null);
      dispatch({ type: 'SET_LISTENING', payload: true });

      // Report the gap since previous end — useful for mobile diagnosis
      // (Chrome Android often gives 200-800ms gaps; iOS Safari can be worse).
      if (recognitionEndedAtRef.current > 0) {
        const gap = now - recognitionEndedAtRef.current;
        recognitionEndedAtRef.current = 0;
        pushDebug('start', `started (gap ${gap}ms, restart #${restartCountRef.current})`);
      } else {
        pushDebug('start', 'recognition started');
      }
    };

    recognition.onresult = (event: any) => {
      lastResultAtRef.current = Date.now();
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const t = result[0].transcript;
        // Some browsers report 0 confidence — treat as "unknown, assume good"
        const rawConf = result[0].confidence;
        const conf = (typeof rawConf === 'number' && rawConf > 0) ? rawConf : 0.85;

        if (result.isFinal) {
          finalTranscriptRef.current += t;
          pushDebug('result-final', `"${t.trim()}"`, conf);
          processTranscript(t, conf);
        } else {
          interimTranscript += t;
        }
      }

      // Cap the running final transcript to avoid unbounded UI growth
      if (finalTranscriptRef.current.length > 2000) {
        finalTranscriptRef.current = finalTranscriptRef.current.slice(-1000);
      }

      const currentTranscript = finalTranscriptRef.current + interimTranscript;
      setTranscript(currentTranscript);
      const lastConf = event.results[event.results.length - 1]?.[0]?.confidence;
      setConfidence(typeof lastConf === 'number' ? lastConf : 0);
      dispatch({ type: 'SET_TRANSCRIPT', payload: currentTranscript });
    };

    recognition.onerror = (event: any) => {
      const code = event.error;
      pushDebug('error', String(code));

      // Transient — let onend handle restart, no UI error state
      if (code === 'no-speech' || code === 'aborted') {
        return;
      }

      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setErrorWithRef('Microphone permission denied');
        isActiveRef.current = false;
        return;
      }

      if (code === 'audio-capture') {
        setErrorWithRef('No microphone detected');
        isActiveRef.current = false;
        return;
      }

      if (code === 'network') {
        console.warn('Speech recognition network error — will retry');
        return;
      }

      console.warn('Speech recognition error:', code);
    };

    recognition.onend = () => {
      recognitionEndedAtRef.current = Date.now();
      pushDebug('end', `active=${isActiveRef.current} err=${errorRef.current ?? '-'}`);

      if (!isActiveRef.current) {
        setIsListening(false);
        dispatch({ type: 'SET_LISTENING', payload: false });
        return;
      }

      if (errorRef.current) {
        setIsListening(false);
        dispatch({ type: 'SET_LISTENING', payload: false });
        return;
      }

      restartRecognitionRef.current();
    };

    return recognition;
  }, [dispatch, processTranscript, setErrorWithRef, pushDebug]);

  const restartRecognition = useCallback(() => {
    if (!isActiveRef.current || errorRef.current) return;

    recognitionRef.current = null;
    restartCountRef.current += 1;

    const attempts = restartAttemptsRef.current;
    const delay = attempts === 0 ? 0 : Math.min(50 * Math.pow(2, attempts - 1), 1000);
    restartAttemptsRef.current = attempts + 1;

    const fire = () => {
      if (!isActiveRef.current || errorRef.current) return;
      try {
        // Use pre-warmed instance if available — saves construction time on the gap
        const wasPrewarmed = !!nextRecognitionRef.current;
        let recognition = nextRecognitionRef.current;
        nextRecognitionRef.current = null;
        if (!recognition) {
          recognition = createRecognitionInstance();
        }
        recognitionRef.current = recognition;
        pushDebug('restart', wasPrewarmed ? 'restart (pre-warmed)' : 'restart (cold)');
        recognition.start();

        // Pre-warm the next instance for the next restart cycle
        setTimeout(() => {
          if (isActiveRef.current && !errorRef.current && !nextRecognitionRef.current) {
            try {
              nextRecognitionRef.current = createRecognitionInstance();
            } catch (_) {
              // Ignore; we'll construct on demand
            }
          }
        }, 200);
      } catch (err: any) {
        const msg = String(err?.message || err);
        if (msg.includes('already started') || msg.includes('InvalidStateError')) {
          // The pre-warmed instance was tainted; throw it away and retry fresh
          nextRecognitionRef.current = null;
          restartTimeoutRef.current = setTimeout(fire, 150);
          return;
        }
        console.error('Failed to restart recognition:', err);
        if (restartAttemptsRef.current < 5) {
          restartTimeoutRef.current = setTimeout(fire, 250);
        } else {
          setErrorWithRef('Speech recognition failed to restart');
          isActiveRef.current = false;
          setIsListening(false);
          dispatch({ type: 'SET_LISTENING', payload: false });
        }
      }
    };

    if (delay === 0) {
      Promise.resolve().then(fire);
    } else {
      restartTimeoutRef.current = setTimeout(fire, delay);
    }
  }, [createRecognitionInstance, dispatch, setErrorWithRef, pushDebug]);

  // Wire forward-declared ref
  useEffect(() => {
    restartRecognitionRef.current = restartRecognition;
  }, [restartRecognition]);

  // Watchdog: if no result for >15s while supposedly listening, force restart.
  // Catches silent stalls (network, backend) where onend never fires.
  const startWatchdog = useCallback(() => {
    if (watchdogTimeoutRef.current) clearInterval(watchdogTimeoutRef.current);
    watchdogTimeoutRef.current = setInterval(() => {
      if (!isActiveRef.current || errorRef.current) return;
      const stalled = Date.now() - lastResultAtRef.current > 15000;
      if (stalled && recognitionRef.current) {
        pushDebug('watchdog', 'no results for 15s — forcing restart');
        try {
          recognitionRef.current.abort();
        } catch (_) {
          restartRecognitionRef.current();
        }
      }
    }, 5000);
  }, [pushDebug]);

  const stopWatchdog = useCallback(() => {
    if (watchdogTimeoutRef.current) {
      clearInterval(watchdogTimeoutRef.current);
      watchdogTimeoutRef.current = null;
    }
  }, []);

  const startListening = useCallback(async () => {
    if (!browserSupportsSpeechRecognition || isActiveRef.current) return;

    // Reset state for a fresh session
    errorRef.current = null;
    setError(null);
    dispatch({ type: 'SET_ERROR', payload: null });
    finalTranscriptRef.current = '';
    restartAttemptsRef.current = 0;
    restartCountRef.current = 0;
    recognitionEndedAtRef.current = 0;
    nextRecognitionRef.current = null;
    lastResultAtRef.current = Date.now();

    try {
      // Mark active before kicking off async work so concurrent calls bail
      isActiveRef.current = true;

      // Start audio recording ONCE for the session (independent of recognition cycles)
      await startAudioRecording();

      // Clear any existing timeouts / instances
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (_) {}
        recognitionRef.current = null;
      }

      const recognition = createRecognitionInstance();
      recognitionRef.current = recognition;
      recognition.start();

      startWatchdog();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setErrorWithRef(`Failed to start: ${err}`);
      isActiveRef.current = false;
      setIsListening(false);
      dispatch({ type: 'SET_LISTENING', payload: false });
      stopAudioRecording();
    }
  }, [
    browserSupportsSpeechRecognition,
    createRecognitionInstance,
    dispatch,
    setErrorWithRef,
    startAudioRecording,
    startWatchdog,
    stopAudioRecording,
  ]);

  const stopListening = useCallback(() => {
    isActiveRef.current = false;

    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    stopWatchdog();

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (_) {}
      recognitionRef.current = null;
    }
    // Discard any pre-warmed instance so it doesn't leak past stop
    nextRecognitionRef.current = null;

    stopAudioRecording();
    setIsListening(false);
    dispatch({ type: 'SET_LISTENING', payload: false });
  }, [dispatch, stopAudioRecording, stopWatchdog]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    finalTranscriptRef.current = '';
    dispatch({ type: 'SET_TRANSCRIPT', payload: '' });
  }, [dispatch]);

  const getSessionAudioBlob = useCallback((): Blob | null => {
    if (sessionChunksRef.current.length === 0) return null;
    return new Blob(sessionChunksRef.current, { type: sessionMimeRef.current });
  }, []);

  const downloadSessionAudio = useCallback(() => {
    const blob = getSessionAudioBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ext = sessionMimeRef.current.includes('ogg') ? 'ogg'
      : sessionMimeRef.current.includes('mp4') ? 'mp4'
      : 'webm';
    const ts = new Date(sessionStartedAtRef.current || Date.now())
      .toISOString().replace(/[:.]/g, '-');
    a.download = `voice-tally-${ts}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [getSessionAudioBlob]);

  const clearSessionAudio = useCallback(() => {
    sessionChunksRef.current = [];
    setSessionRecordingSize(0);
    setSessionHasAudio(false);
  }, []);

  const clearDebugEvents = useCallback(() => {
    setDebugEvents([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      if (watchdogTimeoutRef.current) clearInterval(watchdogTimeoutRef.current);
      try { recognitionRef.current?.abort(); } catch (_) {}
      nextRecognitionRef.current = null;
      try {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      } catch (_) {}
      try { micStreamRef.current?.getTracks().forEach(t => t.stop()); } catch (_) {}
    };
  }, []);

  return {
    isListening,
    transcript,
    confidence,
    error,
    startListening,
    stopListening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    debugEvents,
    clearDebugEvents,
    sessionHasAudio,
    sessionRecordingSize,
    downloadSessionAudio,
    clearSessionAudio,
  };
}
