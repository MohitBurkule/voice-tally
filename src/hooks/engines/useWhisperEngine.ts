// Whisper-tiny.en engine via Transformers.js.
// Best quality of the on-device engines, but chunked (not true streaming):
// we buffer ~3s of mic audio, transcribe, then process the result.
// First-load downloads ~75MB of model weights (cached after).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTally } from '../../context/TallyContext';
import { useTranscriptProcessor } from './useTranscriptProcessor';
import type { UnifiedSpeechRecognition } from './types';

const TARGET_SR = 16000;
const CHUNK_SECONDS = 3.0;

// Downsample a Float32Array from sourceSampleRate to 16kHz using simple
// linear-interp resampling. Sufficient quality for Whisper.
function resampleTo16k(input: Float32Array, sourceSampleRate: number): Float32Array {
  if (sourceSampleRate === TARGET_SR) return input;
  const ratio = sourceSampleRate / TARGET_SR;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcIdx = i * ratio;
    const i0 = Math.floor(srcIdx);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = srcIdx - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
}

export function useWhisperEngine(): UnifiedSpeechRecognition {
  const { dispatch } = useTally();
  const {
    processTranscript,
    pushDebug,
    debugEvents,
    clearDebugEvents,
  } = useTranscriptProcessor();

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [engineStatus, setEngineStatus] = useState('idle');
  const [modelLoadProgress, setModelLoadProgress] = useState<number | undefined>(undefined);

  const transcriberRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const bufferRef = useRef<Float32Array[]>([]);
  const sampleCountRef = useRef(0);
  const isActiveRef = useRef(false);
  const isTranscribingRef = useRef(false);
  const sourceSampleRateRef = useRef(48000);
  const finalTextRef = useRef('');

  const browserSupportsSpeechRecognition = typeof window !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia;

  const ensureTranscriber = useCallback(async (): Promise<any> => {
    if (transcriberRef.current) return transcriberRef.current;
    setEngineStatus('loading-model');
    setModelLoadProgress(0);
    pushDebug('model-load', 'Whisper: downloading whisper-tiny.en (~75MB)…');
    const { pipeline } = await import('@huggingface/transformers');
    // Default dtype on mobile WebGPU is q4 / q4f16. The MatMulNBits operator
    // those use has a broken _scale tensor export → "Can't create a session".
    // Pin to q8 (8-bit, well-supported, ~half the size of fp32) and force
    // device: 'wasm' so we don't hit WebGPU defaults.
    const transcriber: any = await pipeline(
      'automatic-speech-recognition',
      'Xenova/whisper-tiny.en',
      {
        device: 'wasm' as any,
        dtype: 'q8' as any,
        progress_callback: (p: any) => {
          if (typeof p?.progress === 'number') {
            setModelLoadProgress(p.progress / 100);
          }
        },
      },
    );
    transcriberRef.current = transcriber;
    setModelLoadProgress(1);
    setEngineStatus('model-ready');
    pushDebug('model-load', 'Whisper: model ready');
    return transcriber;
  }, [pushDebug]);

  const flushChunk = useCallback(async () => {
    if (!isActiveRef.current || isTranscribingRef.current) return;
    const needed = sourceSampleRateRef.current * CHUNK_SECONDS;
    if (sampleCountRef.current < needed) return;

    isTranscribingRef.current = true;

    // Drain buffered chunks into a single Float32Array
    const totalLen = sampleCountRef.current;
    const merged = new Float32Array(totalLen);
    let off = 0;
    for (const c of bufferRef.current) {
      merged.set(c, off);
      off += c.length;
    }
    bufferRef.current = [];
    sampleCountRef.current = 0;

    try {
      const resampled = resampleTo16k(merged, sourceSampleRateRef.current);
      const transcriber = transcriberRef.current;
      const result = await transcriber(resampled);
      const text: string = result?.text?.trim?.() || '';
      if (text) {
        finalTextRef.current += (finalTextRef.current ? ' ' : '') + text;
        if (finalTextRef.current.length > 2000) {
          finalTextRef.current = finalTextRef.current.slice(-1000);
        }
        setTranscript(finalTextRef.current);
        dispatch({ type: 'SET_TRANSCRIPT', payload: finalTextRef.current });
        setConfidence(0.9);
        pushDebug('result-final', `"${text}"`, 0.9);
        processTranscript(text, 0.9);
      }
    } catch (err: any) {
      console.error('Whisper transcribe failed:', err);
      pushDebug('error', `whisper: ${String(err?.message || err)}`);
    } finally {
      isTranscribingRef.current = false;
    }
  }, [dispatch, processTranscript, pushDebug]);

  const startListening = useCallback(async () => {
    if (isActiveRef.current) return;
    isActiveRef.current = true;
    setError(null);
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      pushDebug('engine', 'engine=whisper');

      await ensureTranscriber();

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
      sourceSampleRateRef.current = audioCtx.sampleRate;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorNodeRef.current = processor;

      bufferRef.current = [];
      sampleCountRef.current = 0;

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!isActiveRef.current) return;
        const data = e.inputBuffer.getChannelData(0);
        // Copy because the underlying buffer is reused
        const copy = new Float32Array(data.length);
        copy.set(data);
        bufferRef.current.push(copy);
        sampleCountRef.current += copy.length;
        // Trigger flush when chunk is full
        if (sampleCountRef.current >= sourceSampleRateRef.current * CHUNK_SECONDS) {
          flushChunk();
        }
      };
      source.connect(processor);
      processor.connect(audioCtx.destination);

      setIsListening(true);
      dispatch({ type: 'SET_LISTENING', payload: true });
      setEngineStatus('listening');
      pushDebug('start', 'Whisper listening (3s chunks)');
    } catch (err: any) {
      const msg = String(err?.message || err);
      console.error('Whisper start failed:', err);
      setError(msg);
      dispatch({ type: 'SET_ERROR', payload: msg });
      pushDebug('error', msg);
      isActiveRef.current = false;
      setIsListening(false);
      dispatch({ type: 'SET_LISTENING', payload: false });
    }
  }, [dispatch, ensureTranscriber, flushChunk, pushDebug]);

  const stopListening = useCallback(() => {
    isActiveRef.current = false;
    try { processorNodeRef.current?.disconnect(); } catch (_) {}
    try { sourceNodeRef.current?.disconnect(); } catch (_) {}
    try { audioContextRef.current?.close(); } catch (_) {}
    try { micStreamRef.current?.getTracks().forEach(t => t.stop()); } catch (_) {}
    processorNodeRef.current = null;
    sourceNodeRef.current = null;
    audioContextRef.current = null;
    micStreamRef.current = null;
    bufferRef.current = [];
    sampleCountRef.current = 0;
    setIsListening(false);
    dispatch({ type: 'SET_LISTENING', payload: false });
    setEngineStatus('idle');
    pushDebug('end', 'Whisper stopped');
  }, [dispatch, pushDebug]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    finalTextRef.current = '';
    dispatch({ type: 'SET_TRANSCRIPT', payload: '' });
  }, [dispatch]);

  useEffect(() => () => {
    isActiveRef.current = false;
    try { processorNodeRef.current?.disconnect(); } catch (_) {}
    try { sourceNodeRef.current?.disconnect(); } catch (_) {}
    try { audioContextRef.current?.close(); } catch (_) {}
    try { micStreamRef.current?.getTracks().forEach(t => t.stop()); } catch (_) {}
  }, []);

  const prefetchModel = useCallback(async () => {
    await ensureTranscriber();
  }, [ensureTranscriber]);

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
    modelCached: !!transcriberRef.current,
  };
}
