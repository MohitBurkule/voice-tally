// Vosk-browser engine: Kaldi ASR via WASM. Streaming, on-device, offline.
// Loads ~40MB small-en model on first start (cached after).
// We constrain the recognizer's vocab to the user's target words + homophones,
// which dramatically improves accuracy for the tally use case.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTally } from '../../context/TallyContext';
import { useTranscriptProcessor } from './useTranscriptProcessor';
import type { UnifiedSpeechRecognition } from './types';

const VOSK_MODEL_URL =
  'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-en-us-0.15.tar.gz';

export function useVoskEngine(): UnifiedSpeechRecognition {
  const { state, dispatch } = useTally();
  const {
    processTranscript,
    pushDebug,
    debugEvents,
    clearDebugEvents,
    targetWordsRef,
  } = useTranscriptProcessor();

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [engineStatus, setEngineStatus] = useState('idle');
  const [modelLoadProgress, setModelLoadProgress] = useState<number | undefined>(undefined);

  const modelRef = useRef<any>(null);
  const recognizerRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const finalTextRef = useRef('');
  const isActiveRef = useRef(false);

  const browserSupportsSpeechRecognition = typeof window !== 'undefined' &&
    typeof window.WebAssembly !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia;

  const buildGrammar = useCallback((): string => {
    // Vosk grammar: JSON array of allowed phrases. "[unk]" allows unknown words
    // to be transcribed as <unk> rather than rejected, keeping the recognizer
    // running smoothly when off-vocab speech occurs.
    const words = new Set<string>();
    for (const tw of targetWordsRef.current) {
      if (tw.word) words.add(tw.word.toLowerCase());
      for (const h of tw.homophones || []) {
        if (h) words.add(h.toLowerCase());
      }
    }
    return JSON.stringify(['[unk]', ...Array.from(words)]);
  }, [targetWordsRef]);

  const ensureModel = useCallback(async (): Promise<any> => {
    if (modelRef.current) return modelRef.current;
    setEngineStatus('loading-model');
    setModelLoadProgress(0);
    pushDebug('model-load', 'Vosk: downloading small-en model (~40MB)…');
    const { createModel } = await import('vosk-browser');
    const model = await createModel(VOSK_MODEL_URL);
    modelRef.current = model;
    setModelLoadProgress(1);
    setEngineStatus('model-ready');
    pushDebug('model-load', 'Vosk: model ready');
    return model;
  }, [pushDebug]);

  const startListening = useCallback(async () => {
    if (isActiveRef.current) return;
    isActiveRef.current = true;
    setError(null);
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      pushDebug('engine', 'engine=vosk');

      const model = await ensureModel();
      const grammar = buildGrammar();
      const recognizer = new model.KaldiRecognizer(16000, grammar);
      recognizer.setWords(true);
      recognizerRef.current = recognizer;

      recognizer.on('result', (message: any) => {
        const text: string = message?.result?.text || '';
        if (!text) return;
        // Average word confidence
        const words = message?.result?.result || [];
        const conf = words.length
          ? words.reduce((s: number, w: any) => s + (w.conf || 0), 0) / words.length
          : 1;
        finalTextRef.current += (finalTextRef.current ? ' ' : '') + text;
        if (finalTextRef.current.length > 2000) {
          finalTextRef.current = finalTextRef.current.slice(-1000);
        }
        setTranscript(finalTextRef.current);
        dispatch({ type: 'SET_TRANSCRIPT', payload: finalTextRef.current });
        setConfidence(conf);
        pushDebug('result-final', `"${text}"`, conf);
        processTranscript(text, conf);
      });

      recognizer.on('partialresult', (message: any) => {
        const partial = message?.result?.partial || '';
        if (!partial) return;
        const combined = finalTextRef.current + (finalTextRef.current ? ' ' : '') + partial;
        setTranscript(combined);
        dispatch({ type: 'SET_TRANSCRIPT', payload: combined });
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;

      const AudioCtor = (window as any).AudioContext || (window as any).webkitAudioContext;
      const audioCtx: AudioContext = new AudioCtor();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      // ScriptProcessorNode is deprecated but the most portable way to grab
      // raw PCM in all mobile browsers without an AudioWorklet module. Vosk
      // resamples internally via acceptWaveformFloat(sampleRate).
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorNodeRef.current = processor;
      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        try {
          recognizer.acceptWaveformFloat(
            e.inputBuffer.getChannelData(0),
            audioCtx.sampleRate,
          );
        } catch (err) {
          console.warn('Vosk acceptWaveformFloat failed:', err);
        }
      };
      source.connect(processor);
      processor.connect(audioCtx.destination);

      setIsListening(true);
      dispatch({ type: 'SET_LISTENING', payload: true });
      setEngineStatus('listening');
      pushDebug('start', 'Vosk listening');
    } catch (err: any) {
      const msg = String(err?.message || err);
      console.error('Vosk start failed:', err);
      setError(msg);
      dispatch({ type: 'SET_ERROR', payload: msg });
      pushDebug('error', msg);
      isActiveRef.current = false;
      setIsListening(false);
      dispatch({ type: 'SET_LISTENING', payload: false });
    }
  }, [buildGrammar, dispatch, ensureModel, processTranscript, pushDebug]);

  const stopListening = useCallback(() => {
    isActiveRef.current = false;
    try { processorNodeRef.current?.disconnect(); } catch (_) {}
    try { sourceNodeRef.current?.disconnect(); } catch (_) {}
    try { audioContextRef.current?.close(); } catch (_) {}
    try { micStreamRef.current?.getTracks().forEach(t => t.stop()); } catch (_) {}
    try { recognizerRef.current?.remove(); } catch (_) {}
    processorNodeRef.current = null;
    sourceNodeRef.current = null;
    audioContextRef.current = null;
    micStreamRef.current = null;
    recognizerRef.current = null;
    setIsListening(false);
    dispatch({ type: 'SET_LISTENING', payload: false });
    setEngineStatus('idle');
    pushDebug('end', 'Vosk stopped');
  }, [dispatch, pushDebug]);

  // Stable vocab signature: only words + homophones, NOT counts. Without this,
  // every INCREMENT_WORD reducer returns a new targetWords array reference and
  // re-triggers the rebuild, restarting the engine after every match.
  const vocabSignature = useMemo(
    () =>
      state.targetWords
        .map(tw => [tw.word, ...(tw.homophones || [])].join(','))
        .join('|'),
    [state.targetWords],
  );

  // Rebuild recognizer only when the vocabulary actually changes mid-session
  useEffect(() => {
    if (!isActiveRef.current || !modelRef.current) return;
    stopListening();
    setTimeout(() => { startListening(); }, 250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vocabSignature]);

  useEffect(() => () => {
    isActiveRef.current = false;
    try { processorNodeRef.current?.disconnect(); } catch (_) {}
    try { sourceNodeRef.current?.disconnect(); } catch (_) {}
    try { audioContextRef.current?.close(); } catch (_) {}
    try { micStreamRef.current?.getTracks().forEach(t => t.stop()); } catch (_) {}
    try { recognizerRef.current?.remove(); } catch (_) {}
    try { modelRef.current?.terminate(); } catch (_) {}
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    finalTextRef.current = '';
    dispatch({ type: 'SET_TRANSCRIPT', payload: '' });
  }, [dispatch]);

  const prefetchModel = useCallback(async () => {
    await ensureModel();
  }, [ensureModel]);

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
    sessionHasAudio: false,
    sessionRecordingSize: 0,
    downloadSessionAudio: () => {},
    clearSessionAudio: () => {},
    engineStatus,
    modelLoadProgress,
    prefetchModel,
    modelCached: !!modelRef.current,
  };
}
