
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, Undo, Redo, Settings, Zap } from 'lucide-react';
import { useTally } from '../context/TallyContext';
import { useSpeechEngine } from '../hooks/engines/useSpeechEngine';
import { useWakeLock } from '../hooks/useWakeLock';
import { startBackgroundMic, stopBackgroundMic } from '../native/backgroundMic';
import { useSEO } from '../seo/SEOContext';
import EnhancedStatusIndicator from '../components/EnhancedStatusIndicator';
import EnhancedTallyCard from '../components/EnhancedTallyCard';
import DebugPanel from '../components/DebugPanel';
import Hints from '../components/Hints';
import SEOFooter from '../components/SEOFooter';
import SisterAppsFooter from '../components/SisterAppsFooter';

const TallyPage: React.FC = () => {
  const { state, dispatch, undo, redo, canUndo, canRedo } = useTally();
  const seo = useSEO();

  const {
    isListening,
    startListening,
    stopListening,
    browserSupportsSpeechRecognition,
    error,
    confidence,
    debugEvents,
    clearDebugEvents,
    sessionHasAudio,
    sessionRecordingSize,
    downloadSessionAudio,
    clearSessionAudio,
    engineStatus,
    modelLoadProgress,
  } = useSpeechEngine();

  // Keep the screen on while listening — the only reliable way to stop
  // mobile browsers from suspending the mic when the screen would lock.
  useWakeLock(isListening);

  // On the Android APK, start a typed foreground service so the mic keeps
  // running with the screen off / app backgrounded. No-op in browsers
  // (falls back to Wake Lock above).
  useEffect(() => {
    if (isListening) {
      startBackgroundMic();
      return () => {
        stopBackgroundMic();
      };
    }
  }, [isListening]);

  const handleStartStop = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleResetAll = () => {
    dispatch({ type: 'RESET_ALL' });
  };

  const totalDetections = state.targetWords.reduce((sum, word) => sum + word.count, 0);

  // Keyboard shortcuts: digit keys 1-9 increment, Shift+digit decrement.
  // Maps to target words by position (matches the index badge on each card).
  // Skips when user is typing in an input/textarea so settings forms work
  // normally.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      // Undo/redo
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (canUndo) undo();
        return;
      }
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault();
        if (canRedo) redo();
        return;
      }
      // Spacebar: start/stop listening
      if (e.code === 'Space' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (isListening) stopListening(); else startListening();
        return;
      }
      // Digit row: increment word at index (1 = first, 9 = ninth, 0 = tenth)
      // Use e.code so Shift+1 (which produces "!") still maps to Digit1.
      const m = /^Digit(\d)$/.exec(e.code);
      if (!m) return;
      const digit = parseInt(m[1], 10);
      const idx = digit === 0 ? 9 : digit - 1;
      const word = state.targetWords[idx];
      if (!word) return;
      e.preventDefault();
      if (e.shiftKey) {
        dispatch({ type: 'DECREMENT_WORD', payload: word.id });
      } else {
        dispatch({
          type: 'INCREMENT_WORD',
          payload: { wordId: word.id, detectedWord: word.word },
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    state.targetWords,
    dispatch,
    undo,
    redo,
    canUndo,
    canRedo,
    isListening,
    startListening,
    stopListening,
  ]);

  if (!browserSupportsSpeechRecognition) {
    return (
      <div className="container mx-auto px-4 py-12">
        <motion.div
          className="max-w-lg mx-auto bg-card border border-border rounded-2xl p-8 text-center shadow-xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Settings className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold text-card-foreground mb-3">
            Speech Recognition Unavailable
          </h2>
          <p className="text-muted-foreground mb-6">
            Your browser doesn't support advanced speech recognition. Please use Chrome, Edge, or Safari for the best experience.
          </p>
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm text-muted-foreground">
              <strong>Recommended browsers:</strong><br />
              • Chrome 25+ • Edge 79+ • Safari 14+
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-3 sm:px-4 py-5 sm:py-12 space-y-5 sm:space-y-12">
        {/* Header with stats */}
        <motion.div
          className="text-center space-y-2 sm:space-y-4"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
        >
          <div className="flex items-center justify-center space-x-2 sm:space-x-3 mb-1 sm:mb-2">
            <div className="w-2 h-2 sm:w-3 sm:h-3 bg-primary rounded-full animate-pulse" />
            <h1 className="text-2xl sm:text-5xl font-black bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
              {seo.h1}
            </h1>
            <div className="w-2 h-2 sm:w-3 sm:h-3 bg-primary rounded-full animate-pulse" />
          </div>

          <p className="text-sm sm:text-xl text-muted-foreground max-w-2xl mx-auto px-2">
            {seo.subtitle}
          </p>

          {/* Stats bar */}
          <motion.div
            className="flex items-center justify-center space-x-5 sm:space-x-8 bg-card/50 backdrop-blur-sm rounded-2xl p-3 sm:p-4 border border-border/50 max-w-md mx-auto"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-bold text-primary">{totalDetections}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">Total</div>
            </div>
            <div className="w-px h-7 sm:h-8 bg-border" />
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-bold text-green-500">{state.targetWords.length}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">Words</div>
            </div>
            <div className="w-px h-7 sm:h-8 bg-border" />
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1">
                <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                <div className="text-xs sm:text-sm font-medium">{isListening ? 'Live' : 'Idle'}</div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Enhanced Status Indicator */}
        <EnhancedStatusIndicator confidence={confidence} />

        {/* Debug panel — collapsible, shows live transcript, events, audio download */}
        <DebugPanel
          confidence={confidence}
          debugEvents={debugEvents}
          clearDebugEvents={clearDebugEvents}
          sessionHasAudio={sessionHasAudio}
          sessionRecordingSize={sessionRecordingSize}
          downloadSessionAudio={downloadSessionAudio}
          clearSessionAudio={clearSessionAudio}
          engineStatus={engineStatus}
          modelLoadProgress={modelLoadProgress}
        />

        {/* Context-aware hints — appears only when likely needed */}
        <Hints
          isListening={isListening}
          browserSupports={browserSupportsSpeechRecognition}
          error={error}
          engineStatus={engineStatus}
          modelLoadProgress={modelLoadProgress}
        />

        {/* Control Panel */}
        <motion.div
          className="flex flex-col items-stretch sm:items-center sm:flex-row sm:justify-center gap-3 sm:gap-6"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          {/* Main control button — full-width on mobile so it's the obvious primary action */}
          <motion.button
            onClick={handleStartStop}
            className={`relative w-full sm:w-auto px-6 sm:px-12 py-4 sm:py-6 rounded-2xl font-bold text-base sm:text-xl transition-all duration-500 flex items-center justify-center space-x-3 sm:space-x-4 shadow-xl ${
              isListening
                ? 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700'
                : 'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:from-primary/90 hover:to-primary'
            } group overflow-hidden`}
            whileHover={{ scale: 1.05, y: -3 }}
            whileTap={{ scale: 0.95 }}
            disabled={!browserSupportsSpeechRecognition}
            title="Spacebar"
          >
            {/* Animated background */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"
              animate={isListening ? { x: ['-100%', '100%'] } : {}}
              transition={isListening ? { duration: 2, repeat: Infinity } : {}}
            />

            <div className="relative z-10 flex items-center space-x-3 sm:space-x-4">
              {isListening ? (
                <>
                  <Pause className="h-5 w-5 sm:h-7 sm:w-7" />
                  <span>Stop Listening</span>
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 sm:h-7 sm:w-7" />
                  <span>Start Listening</span>
                </>
              )}
              <Zap className="h-4 w-4 sm:h-5 sm:w-5 opacity-60 group-hover:opacity-100 transition-opacity" />
            </div>
          </motion.button>

          {/* Secondary controls — Reset / Undo / Redo. On mobile they share a
              single row below the primary button so the primary button stays
              tappable without scrolling. */}
          <div className="flex items-center justify-center gap-2 sm:space-x-3">
            <motion.button
              onClick={handleResetAll}
              className="flex-1 sm:flex-none px-4 sm:px-8 py-3 sm:py-6 bg-card border border-border text-card-foreground rounded-xl sm:rounded-2xl font-semibold hover:bg-card/80 transition-all duration-300 flex items-center justify-center space-x-2 sm:space-x-3 shadow-lg text-sm sm:text-base"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <RotateCcw className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>Reset</span>
            </motion.button>

            <motion.button
              onClick={undo}
              disabled={!canUndo}
              className="p-3 sm:p-4 bg-muted text-muted-foreground rounded-xl hover:bg-muted/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 shadow-md"
              whileHover={{ scale: canUndo ? 1.1 : 1, y: canUndo ? -2 : 0 }}
              whileTap={{ scale: canUndo ? 0.9 : 1 }}
              title="Undo (Ctrl/⌘+Z)"
            >
              <Undo className="h-4 w-4 sm:h-5 sm:w-5" />
            </motion.button>

            <motion.button
              onClick={redo}
              disabled={!canRedo}
              className="p-3 sm:p-4 bg-muted text-muted-foreground rounded-xl hover:bg-muted/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 shadow-md"
              whileHover={{ scale: canRedo ? 1.1 : 1, y: canRedo ? -2 : 0 }}
              whileTap={{ scale: canRedo ? 0.9 : 1 }}
              title="Redo (Ctrl/⌘+Shift+Z)"
            >
              <Redo className="h-4 w-4 sm:h-5 sm:w-5" />
            </motion.button>
          </div>
        </motion.div>

        {/* Keyboard hint — hidden on touch-only devices */}
        <div className="hidden md:block text-center text-xs text-muted-foreground/70">
          Shortcuts: <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">Space</kbd> start/stop ·{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">1</kbd>–
          <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">9</kbd> +1 ·{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">Shift</kbd>+digit −1
        </div>

        {/* Enhanced Tally Cards */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <AnimatePresence>
            {state.targetWords.map((word, index) => (
              <EnhancedTallyCard key={word.id} word={word} index={index} />
            ))}
          </AnimatePresence>
        </motion.div>

        {/* Empty State */}
        {state.targetWords.length === 0 && (
          <motion.div
            className="text-center py-20"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8 }}
          >
            <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Settings className="h-12 w-12 text-primary" />
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-3">
              No Target Words Configured
            </h3>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Add your first target words in Settings to start using the voice tally counter
            </p>
            <motion.a
              href="/settings"
              className="inline-flex items-center space-x-3 px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-semibold hover:bg-primary/90 transition-colors duration-300 shadow-lg"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <Settings className="h-5 w-5" />
              <span>Configure Settings</span>
            </motion.a>
          </motion.div>
        )}

        {/* Footer info */}
        {state.targetWords.length > 0 && (
          <motion.div
            className="text-center text-sm text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            Using advanced speech recognition • Confidence threshold: {Math.round(state.settings.confidenceThreshold * 100)}%
          </motion.div>
        )}

        {/* Backlinks to sibling apps on app.scot */}
        <SisterAppsFooter />

        {/* SEO link cluster — small, muted, crawlable */}
        <SEOFooter />
      </div>
    </div>
  );
};

export default TallyPage;
