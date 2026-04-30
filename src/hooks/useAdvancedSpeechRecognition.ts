
import { useState, useRef, useCallback, useEffect } from 'react';
import { useTally } from '../context/TallyContext';

interface UseAdvancedSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  confidence: number;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  browserSupportsSpeechRecognition: boolean;
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isActiveRef = useRef(false);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdogTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef('');
  const errorRef = useRef<string | null>(null);
  const lastResultAtRef = useRef<number>(0);
  const restartAttemptsRef = useRef(0);
  const historyCounterRef = useRef(0);

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
    if (conf < confidenceThresholdRef.current) return;

    const lowerText = text.toLowerCase().trim();

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

      const audioBlob = audioChunksRef.current.length > 0
        ? new Blob(audioChunksRef.current, { type: 'audio/webm' })
        : undefined;

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

    // Trim audio chunks to avoid unbounded growth across long sessions
    if (audioChunksRef.current.length > 50) {
      audioChunksRef.current = audioChunksRef.current.slice(-25);
    }
  }, [dispatch, playNotificationSound]);

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

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
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
      lastResultAtRef.current = Date.now();
      // Keep listening UI true across restarts — only set if not already
      setIsListening(true);
      setErrorWithRef(null);
      dispatch({ type: 'SET_LISTENING', payload: true });
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
        // Network errors are often transient — clear after a brief delay,
        // do not stop the session
        console.warn('Speech recognition network error — will retry');
        return;
      }

      // Other errors — log but allow restart
      console.warn('Speech recognition error:', code);
    };

    recognition.onend = () => {
      // If user has stopped, do nothing
      if (!isActiveRef.current) {
        setIsListening(false);
        dispatch({ type: 'SET_LISTENING', payload: false });
        return;
      }

      // Fatal errors abort the session
      if (errorRef.current) {
        setIsListening(false);
        dispatch({ type: 'SET_LISTENING', payload: false });
        return;
      }

      // Auto-restart immediately to minimize the gap
      restartRecognitionRef.current();
    };

    return recognition;
  }, [dispatch, processTranscript, setErrorWithRef]);

  const restartRecognition = useCallback(() => {
    if (!isActiveRef.current || errorRef.current) return;

    // Clear old instance reference
    recognitionRef.current = null;

    // Exponential backoff if we keep failing fast
    const attempts = restartAttemptsRef.current;
    const delay = attempts === 0 ? 0 : Math.min(50 * Math.pow(2, attempts - 1), 1000);
    restartAttemptsRef.current = attempts + 1;

    const fire = () => {
      if (!isActiveRef.current || errorRef.current) return;
      try {
        const recognition = createRecognitionInstance();
        recognitionRef.current = recognition;
        recognition.start();
      } catch (err: any) {
        // InvalidStateError can occur if start() is called before previous instance fully released
        const msg = String(err?.message || err);
        if (msg.includes('already started') || msg.includes('InvalidStateError')) {
          // Schedule another attempt
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
      // Use microtask-equivalent to let onend fully unwind
      Promise.resolve().then(fire);
    } else {
      restartTimeoutRef.current = setTimeout(fire, delay);
    }
  }, [createRecognitionInstance, dispatch, setErrorWithRef]);

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
        console.warn('Speech recognition appears stalled — forcing restart');
        try {
          recognitionRef.current.abort();
        } catch (_) {
          restartRecognitionRef.current();
        }
        // onend will fire and trigger restart
      }
    }, 5000);
  }, []);

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

    stopAudioRecording();
    setIsListening(false);
    dispatch({ type: 'SET_LISTENING', payload: false });
  }, [dispatch, stopAudioRecording, stopWatchdog]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    finalTranscriptRef.current = '';
    dispatch({ type: 'SET_TRANSCRIPT', payload: '' });
  }, [dispatch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      if (watchdogTimeoutRef.current) clearInterval(watchdogTimeoutRef.current);
      try { recognitionRef.current?.abort(); } catch (_) {}
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
  };
}
