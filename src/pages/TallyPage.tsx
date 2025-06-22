
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, Undo, Redo } from 'lucide-react';
import { useTally } from '../context/TallyContext';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import StatusIndicator from '../components/StatusIndicator';
import TallyCard from '../components/TallyCard';

const TallyPage: React.FC = () => {
  const { state, dispatch, undo, redo, canUndo, canRedo } = useTally();
  const { 
    isListening, 
    startListening, 
    stopListening, 
    browserSupportsSpeechRecognition 
  } = useSpeechRecognition();

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

  if (!browserSupportsSpeechRecognition) {
    return (
      <div className="container mx-auto px-4 py-8">
        <motion.div
          className="max-w-md mx-auto bg-card border border-border rounded-xl p-6 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-xl font-bold text-card-foreground mb-2">
            Speech Recognition Not Supported
          </h2>
          <p className="text-muted-foreground">
            Your browser doesn't support speech recognition. Please try using Chrome, Edge, or Safari.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-4xl font-bold text-foreground mb-2">
          Voice Tally Counter
        </h1>
        <p className="text-muted-foreground">
          Start listening to automatically count your target words
        </p>
      </motion.div>

      {/* Status Indicator */}
      <StatusIndicator />

      {/* Control Buttons */}
      <motion.div
        className="flex items-center justify-center space-x-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <motion.button
          onClick={handleStartStop}
          className={`px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 flex items-center space-x-3 ${
            isListening
              ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg'
              : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg'
          }`}
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          disabled={!browserSupportsSpeechRecognition}
        >
          {isListening ? (
            <>
              <Pause className="h-5 w-5" />
              <span>Stop Listening</span>
            </>
          ) : (
            <>
              <Play className="h-5 w-5" />
              <span>Start Listening</span>
            </>
          )}
        </motion.button>

        <motion.button
          onClick={handleResetAll}
          className="px-6 py-4 bg-secondary text-secondary-foreground rounded-xl font-semibold hover:bg-secondary/90 transition-all duration-300 flex items-center space-x-2"
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
        >
          <RotateCcw className="h-5 w-5" />
          <span>Reset All</span>
        </motion.button>
      </motion.div>

      {/* Undo/Redo Controls */}
      <motion.div
        className="flex items-center justify-center space-x-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <motion.button
          onClick={undo}
          disabled={!canUndo}
          className="p-3 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          whileHover={{ scale: canUndo ? 1.1 : 1 }}
          whileTap={{ scale: canUndo ? 0.9 : 1 }}
          title="Undo last action"
        >
          <Undo className="h-4 w-4" />
        </motion.button>
        
        <motion.button
          onClick={redo}
          disabled={!canRedo}
          className="p-3 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          whileHover={{ scale: canRedo ? 1.1 : 1 }}
          whileTap={{ scale: canRedo ? 0.9 : 1 }}
          title="Redo last action"
        >
          <Redo className="h-4 w-4" />
        </motion.button>
      </motion.div>

      {/* Tally Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {state.targetWords.map((word, index) => (
            <TallyCard key={word.id} word={word} index={index} />
          ))}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {state.targetWords.length === 0 && (
        <motion.div
          className="text-center py-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <p className="text-muted-foreground mb-4">
            No target words configured. Add some words in Settings to get started!
          </p>
          <motion.a
            href="/settings"
            className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors duration-200"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Go to Settings
          </motion.a>
        </motion.div>
      )}
    </div>
  );
};

export default TallyPage;
