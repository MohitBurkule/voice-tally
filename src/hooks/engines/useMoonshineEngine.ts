// Moonshine-tiny engine via Transformers.js.
// Moonshine is a 2024 mobile-optimized streaming ASR — faster and smaller than
// Whisper-tiny while matching quality on English. Loaded as an ONNX model
// through the same Transformers.js pipeline as Whisper.
//
// Uses the same 3s chunking strategy as Whisper for simplicity.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTally } from '../../context/TallyContext';
import { useTranscriptProcessor } from './useTranscriptProcessor';
import type { UnifiedSpeechRecognition } from './types';

const TARGET_SR = 16000;
const CHUNK_SECONDS = 2.0; // Moonshine handles short clips well

// Root-mean-square audio energy. Below ~0.005 is effectively silence for a
// 16 kHz mic stream after echoCancellation+noiseSuppression. We use this to
// skip transcription on quiet chunks — Whisper-family models hallucinate
// repeated tokens when fed near-silent audio.
function rms(arr: Float32Array): number {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i] * arr[i];
  return Math.sqrt(s / Math.max(1, arr.length));
}

// Cap repeated occurrences of any single token in one chunk's transcript.
// The cap is derived from the chunk duration × max sustainable word rate:
// even fast speech tops out around 4 words/sec for sustained repeats, so a
// 2-second chunk that emits the same token >8 times is the decoder looping,
// not the user counting fast. Drops overflow while preserving order — a
// real "react react react react …" still counts up to the physical bound.
function capPerTokenRepeats(text: string, maxPerToken: number): string {
  const tokens = text.split(/\s+/);
  const seen: Record<string, number> = {};
  const kept: string[] = [];
  for (const t of tokens) {
    const key = t.toLowerCase().replace(/[^a-z]/g, '');
    if (!key) {
      kept.push(t);
      continue;
    }
    seen[key] = (seen[key] || 0) + 1;
    if (seen[key] > maxPerToken) continue;
    kept.push(t);
  }
  return kept.join(' ');
}

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

export function useMoonshineEngine(): UnifiedSpeechRecognition {
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
    pushDebug('model-load', 'Moonshine: downloading moonshine-tiny…');
    const { pipeline } = await import('@huggingface/transformers');
    // q4/q4f16 (WebGPU defaults) AND q8 both hit the broken MatMulNBits
    // _scale export in moonshine-tiny-ONNX's decoder. Only fp32 pulls
    // non-quantized weights for every sub-model. ~80MB but actually loads
    // on mobile Chrome and Safari.
    const transcriber: any = await pipeline(
      'automatic-speech-recognition',
      'onnx-community/moonshine-tiny-ONNX',
      {
        device: 'wasm' as any,
        dtype: { encoder_model: 'fp32', decoder_model_merged: 'fp32' } as any,
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
    pushDebug('model-load', 'Moonshine: model ready');
    return transcriber;
  }, [pushDebug]);

  const flushChunk = useCallback(async () => {
    if (!isActiveRef.current || isTranscribingRef.current) return;
    const needed = sourceSampleRateRef.current * CHUNK_SECONDS;
    if (sampleCountRef.current < needed) return;

    isTranscribingRef.current = true;

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

      // Skip near-silent chunks — feeding them to the decoder reliably
      // produces hallucinated repeat-loops.
      if (rms(resampled) < 0.005) {
        pushDebug('reject-no-match', '(silence — chunk skipped)', 0);
        return;
      }

      const transcriber = transcriberRef.current;
      const result = await transcriber(resampled);
      const rawText: string = result?.text?.trim?.() || '';
      const maxRepeats = Math.max(2, Math.floor(CHUNK_SECONDS * 6));
      const text = rawText ? capPerTokenRepeats(rawText, maxRepeats) : '';
      if (rawText && text !== rawText) {
        pushDebug('reject-no-match', `(repeat-loop capped: "${rawText}" → "${text}")`, 0);
      }
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
      console.error('Moonshine transcribe failed:', err);
      pushDebug('error', `moonshine: ${String(err?.message || err)}`);
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
      pushDebug('engine', 'engine=moonshine');

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
        const copy = new Float32Array(data.length);
        copy.set(data);
        bufferRef.current.push(copy);
        sampleCountRef.current += copy.length;
        if (sampleCountRef.current >= sourceSampleRateRef.current * CHUNK_SECONDS) {
          flushChunk();
        }
      };
      source.connect(processor);
      processor.connect(audioCtx.destination);

      setIsListening(true);
      dispatch({ type: 'SET_LISTENING', payload: true });
      setEngineStatus('listening');
      pushDebug('start', 'Moonshine listening (2s chunks)');
    } catch (err: any) {
      const msg = String(err?.message || err);
      console.error('Moonshine start failed:', err);
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
    pushDebug('end', 'Moonshine stopped');
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
