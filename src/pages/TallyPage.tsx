
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, Undo, Redo, Settings, Zap } from 'lucide-react';
import { useTally } from '../context/TallyContext';
import { useAdvancedSpeechRecognition } from '../hooks/useAdvancedSpeechRecognition';
import EnhancedStatusIndicator from '../components/EnhancedStatusIndicator';
import EnhancedTallyCard from '../components/EnhancedTallyCard';

const TallyPage: React.FC = () => {
  const { state, dispatch, undo, redo, canUndo, canRedo } = useTally();
  const { 
    isListening, 
    startListening, 
    stopListening, 
    browserSupportsSpeechRecognition,
    error,
    confidence
  } = useAdvancedSpeechRecognition();

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
      <div className="container mx-auto px-4 py-12 space-y-12">
        {/* Header with stats */}
        <motion.div
          className="text-center space-y-4"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
        >
          <div className="flex items-center justify-center space-x-3 mb-2">
            <div className="w-3 h-3 bg-primary rounded-full animate-pulse" />
            <h1 className="text-5xl font-black bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
              Voice Tally Counter
            </h1>
            <div className="w-3 h-3 bg-primary rounded-full animate-pulse" />
          </div>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Advanced speech recognition for real-time word counting
          </p>
          
          {/* Stats bar */}
          <motion.div
            className="flex items-center justify-center space-x-8 bg-card/50 backdrop-blur-sm rounded-2xl p-4 border border-border/50 max-w-md mx-auto"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{totalDetections}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">{state.targetWords.length}</div>
              <div className="text-xs text-muted-foreground">Words</div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1">
                <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                <div className="text-sm font-medium">{isListening ? 'Live' : 'Idle'}</div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Enhanced Status Indicator */}
        <EnhancedStatusIndicator confidence={confidence} />

        {/* Control Panel */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-6"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          {/* Main control button */}
          <motion.button
            onClick={handleStartStop}
            className={`relative px-12 py-6 rounded-2xl font-bold text-xl transition-all duration-500 flex items-center space-x-4 shadow-xl ${
              isListening
                ? 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700'
                : 'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:from-primary/90 hover:to-primary'
            } group overflow-hidden`}
            whileHover={{ scale: 1.05, y: -3 }}
            whileTap={{ scale: 0.95 }}
            disabled={!browserSupportsSpeechRecognition}
          >
            {/* Animated background */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"
              animate={isListening ? { x: ['-100%', '100%'] } : {}}
              transition={isListening ? { duration: 2, repeat: Infinity } : {}}
            />
            
            <div className="relative z-10 flex items-center space-x-4">
              {isListening ? (
                <>
                  <Pause className="h-7 w-7" />
                  <span>Stop Listening</span>
                </>
              ) : (
                <>
                  <Play className="h-7 w-7" />
                  <span>Start Listening</span>
                </>
              )}
              <Zap className="h-5 w-5 opacity-60 group-hover:opacity-100 transition-opacity" />
            </div>
          </motion.button>

          {/* Secondary controls */}
          <div className="flex items-center space-x-3">
            <motion.button
              onClick={handleResetAll}
              className="px-8 py-6 bg-card border border-border text-card-foreground rounded-2xl font-semibold hover:bg-card/80 transition-all duration-300 flex items-center space-x-3 shadow-lg"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <RotateCcw className="h-5 w-5" />
              <span>Reset All</span>
            </motion.button>

            {/* Undo/Redo */}
            <div className="flex items-center space-x-2">
              <motion.button
                onClick={undo}
                disabled={!canUndo}
                className="p-4 bg-muted text-muted-foreground rounded-xl hover:bg-muted/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 shadow-md"
                whileHover={{ scale: canUndo ? 1.1 : 1, y: canUndo ? -2 : 0 }}
                whileTap={{ scale: canUndo ? 0.9 : 1 }}
                title="Undo last action"
              >
                <Undo className="h-5 w-5" />
              </motion.button>
              
              <motion.button
                onClick={redo}
                disabled={!canRedo}
                className="p-4 bg-muted text-muted-foreground rounded-xl hover:bg-muted/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 shadow-md"
                whileHover={{ scale: canRedo ? 1.1 : 1, y: canRedo ? -2 : 0 }}
                whileTap={{ scale: canRedo ? 0.9 : 1 }}
                title="Redo last action"
              >
                <Redo className="h-5 w-5" />
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Enhanced Tally Cards */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
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
      </div>
    </div>
  );
};

export default TallyPage;
