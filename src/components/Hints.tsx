import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, AlertTriangle, MicOff, ArrowRight } from 'lucide-react';
import { useTally } from '../context/TallyContext';

interface HintsProps {
  isListening: boolean;
  browserSupports: boolean;
  error: string | null;
  engineStatus?: string;
  modelLoadProgress?: number;
}

// Context-aware hints shown near the Start button. Surfaces help only when the
// user is likely stuck, instead of cluttering the UI permanently. Rules:
//
//   * Browser doesn't support Web Speech → suggest switching engine.
//   * Engine error → show error + escape hatch.
//   * Listening for 8s with empty transcript → likely mic / engine issue.
//   * Listening for 15s with no count increment → suggest different engine.
//   * Idle but user hasn't started in 30s → gentle nudge to begin.
//
// Each hint links to the relevant fix (Settings / mic perms).

const Hints: React.FC<HintsProps> = ({
  isListening,
  browserSupports,
  error,
  engineStatus,
  modelLoadProgress,
}) => {
  const { state } = useTally();
  const engine = state.settings.engine;
  const transcript = state.currentTranscript;

  // Per-session tracking: when listening starts, snapshot history length and
  // start time. Hints compare to current values.
  const sessionStartRef = useRef<number | null>(null);
  const sessionStartHistoryLenRef = useRef<number>(0);
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    if (isListening && sessionStartRef.current === null) {
      sessionStartRef.current = Date.now();
      sessionStartHistoryLenRef.current = state.history.length;
    } else if (!isListening) {
      sessionStartRef.current = null;
    }
  }, [isListening, state.history.length]);

  // 1s timer to drive hint visibility
  useEffect(() => {
    if (!isListening) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isListening]);

  const elapsedMs = sessionStartRef.current
    ? now - sessionStartRef.current
    : 0;
  const incrementsThisSession =
    state.history.length - sessionStartHistoryLenRef.current;
  const hasTranscript = transcript.trim().length > 0;
  const modelLoading =
    typeof modelLoadProgress === 'number' && modelLoadProgress < 1;

  // Pick the most relevant hint (only one shown at a time, ordered by severity)
  let hint: React.ReactNode = null;
  let tone: 'info' | 'warn' | 'error' = 'info';
  let icon = <Lightbulb className="h-4 w-4" />;

  if (!browserSupports) {
    tone = 'error';
    icon = <AlertTriangle className="h-4 w-4" />;
    hint = (
      <span>
        Your browser doesn't support the Web Speech API. Switch to an offline
        engine (Vosk / Whisper / Moonshine) in{' '}
        <Link to="/settings" className="underline font-medium">
          Settings
        </Link>
        .
      </span>
    );
  } else if (error) {
    tone = 'error';
    icon = <AlertTriangle className="h-4 w-4" />;
    hint = (
      <span>
        Engine error: {error}. If this keeps happening, try a different engine
        in{' '}
        <Link to="/settings" className="underline font-medium">
          Settings
        </Link>
        .
      </span>
    );
  } else if (modelLoading) {
    tone = 'info';
    hint = (
      <span>
        Downloading {engine} model
        {typeof modelLoadProgress === 'number'
          ? ` (${Math.round(modelLoadProgress * 100)}%)`
          : '…'}
        . First start is slow; subsequent starts use the cached copy.
      </span>
    );
  } else if (isListening && elapsedMs > 8000 && !hasTranscript) {
    tone = 'warn';
    icon = <MicOff className="h-4 w-4" />;
    hint = (
      <span>
        No transcription for {Math.floor(elapsedMs / 1000)}s. Check your phone's
        mic permission, or try a different engine in{' '}
        <Link to="/settings" className="underline font-medium">
          Settings
        </Link>
        .{' '}
        {engine === 'webspeech' &&
          'Web Speech needs HTTPS + a network connection on most mobile browsers.'}
      </span>
    );
  } else if (isListening && elapsedMs > 15000 && incrementsThisSession === 0) {
    tone = 'warn';
    icon = <Lightbulb className="h-4 w-4" />;
    hint = (
      <span>
        Heard speech but no target words matched. Either your target words
        aren't being spoken, or this engine ({engine}) is mishearing them. Try
        another engine in{' '}
        <Link to="/settings" className="underline font-medium">
          Settings
        </Link>{' '}
        — Vosk is grammar-constrained to your target words and tends to be
        most accurate for tally tasks.
      </span>
    );
  } else if (!isListening && engine === 'webspeech') {
    // Idle nudge — small persistent tip when using the default engine
    tone = 'info';
    hint = (
      <span>
        Tip: if Web Speech doesn't pick up your words on mobile, switch to{' '}
        <Link to="/settings" className="underline font-medium">
          Vosk or Moonshine
        </Link>{' '}
        — they run on-device and work offline.
      </span>
    );
  } else if (!isListening && (engine === 'vosk' || engine === 'whisper' || engine === 'moonshine')) {
    tone = 'info';
    hint = (
      <span>
        Using on-device {engine}. First start downloads the model (~40–110 MB);
        next time runs offline.
      </span>
    );
  } else if (isListening) {
    // Wake Lock keeps the screen on while listening, but the mic still
    // stops if the user manually locks the phone or switches apps. Surface
    // that caveat so it's not a surprise.
    tone = 'info';
    hint = (
      <span>
        Listening — screen kept awake. If you lock the phone or switch apps the
        mic stops; install the Android APK for true background listening.
      </span>
    );
  }

  if (!hint) return null;

  const colorClass =
    tone === 'error'
      ? 'bg-destructive/10 border-destructive/30 text-destructive'
      : tone === 'warn'
        ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'
        : 'bg-primary/5 border-primary/20 text-muted-foreground';

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={String(hint)}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.25 }}
        className={`rounded-xl border px-4 py-3 flex items-start space-x-3 text-sm ${colorClass}`}
      >
        <div className="shrink-0 mt-0.5">{icon}</div>
        <div className="flex-1">{hint}</div>
        <Link
          to="/settings"
          className="shrink-0 text-xs hover:underline flex items-center space-x-1 opacity-70 hover:opacity-100"
          title="Open Settings"
        >
          <span>Settings</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </motion.div>
    </AnimatePresence>
  );
};

export default Hints;
