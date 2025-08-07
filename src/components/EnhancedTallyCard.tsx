
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, RotateCcw, TrendingUp, Volume2 } from 'lucide-react';
import { TargetWord } from '../context/TallyContext';
import { useTally } from '../context/TallyContext';

interface EnhancedTallyCardProps {
  word: TargetWord;
  index: number;
}

const EnhancedTallyCard: React.FC<EnhancedTallyCardProps> = ({ word, index }) => {
  const { dispatch, state } = useTally();
  const [isAnimating, setIsAnimating] = useState(false);
  const [recentChange, setRecentChange] = useState<'increase' | 'decrease' | null>(null);
  const prevCount = React.useRef(word.count);
  
  // Calculate recent activity
  const recentHistory = state.history
    .filter(item => item.wordId === word.id)
    .slice(-5);

  useEffect(() => {
    if (word.count !== prevCount.current) {
      setIsAnimating(true);
      setRecentChange(word.count > prevCount.current ? 'increase' : 'decrease');
      
      const timer1 = setTimeout(() => setIsAnimating(false), 800);
      const timer2 = setTimeout(() => setRecentChange(null), 2000);
      
      prevCount.current = word.count;
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [word.count]);

  const handleIncrement = () => {
    dispatch({
      type: 'INCREMENT_WORD',
      payload: { wordId: word.id, detectedWord: word.word }
    });
  };

  const handleDecrement = () => {
    dispatch({ type: 'DECREMENT_WORD', payload: word.id });
  };

  const handleReset = () => {
    dispatch({ type: 'RESET_WORD', payload: word.id });
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 50, scale: 0.9 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: {
        duration: 0.6,
        delay: index * 0.1,
        type: "spring",
        stiffness: 100
      }
    },
    hover: { 
      y: -8, 
      scale: 1.02,
      transition: {
        duration: 0.3,
        type: "spring",
        stiffness: 400
      }
    }
  };

  return (
    <motion.div
      className="relative group"
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
    >
      {/* Glow effect on recent activity */}
      {recentChange && (
        <motion.div
          className={`absolute inset-0 rounded-2xl blur-lg ${
            recentChange === 'increase' ? 'bg-green-500/20' : 'bg-red-500/20'
          }`}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1.1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.5 }}
        />
      )}
      
      <div className="relative bg-card border border-border rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <motion.div
              className="w-6 h-6 rounded-full shadow-lg"
              style={{ backgroundColor: word.color }}
              whileHover={{ scale: 1.2, rotate: 180 }}
              transition={{ duration: 0.3 }}
            />
            <div>
              <h3 className="text-2xl font-bold text-card-foreground">{word.word}</h3>
              <p className="text-sm text-muted-foreground">Target word</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Recent activity indicator */}
            {recentHistory.length > 0 && (
              <motion.div
                className="flex items-center space-x-1 text-green-500"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-medium">+{recentHistory.length}</span>
              </motion.div>
            )}
            
            <motion.button
              onClick={handleReset}
              className="p-2 text-muted-foreground hover:text-destructive transition-colors duration-200 rounded-lg hover:bg-destructive/10"
              whileHover={{ scale: 1.1, rotate: -180 }}
              whileTap={{ scale: 0.9 }}
              title="Reset count"
            >
              <RotateCcw className="h-5 w-5" />
            </motion.button>
          </div>
        </div>

        {/* Counter display */}
        <div className="text-center mb-8">
          <div className="relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={word.count}
                className={`text-8xl font-black ${isAnimating ? 'animate-bounce' : ''}`}
                style={{ color: word.color }}
                initial={{ opacity: 0, scale: 0.5, rotateX: -90 }}
                animate={{ opacity: 1, scale: 1, rotateX: 0 }}
                exit={{ opacity: 0, scale: 1.5, rotateX: 90 }}
                transition={{ 
                  duration: 0.5, 
                  type: "spring", 
                  stiffness: 300 
                }}
              >
                {word.count}
              </motion.div>
            </AnimatePresence>
            
            {/* Counter change indicator */}
            <AnimatePresence>
              {recentChange && (
                <motion.div
                  className={`absolute -top-4 -right-4 px-3 py-1 rounded-full text-sm font-bold ${
                    recentChange === 'increase' 
                      ? 'bg-green-500 text-white' 
                      : 'bg-red-500 text-white'
                  }`}
                  initial={{ opacity: 0, scale: 0, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0, y: -10 }}
                >
                  {recentChange === 'increase' ? '+1' : '-1'}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <motion.p
            className="text-muted-foreground mt-3 font-medium"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Total detections
          </motion.p>
        </div>

        {/* Control buttons */}
        <div className="flex items-center justify-center space-x-6 mb-6">
          <motion.button
            onClick={handleDecrement}
            disabled={word.count === 0}
            className="p-4 bg-destructive/10 text-destructive rounded-full hover:bg-destructive/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
            whileHover={{ scale: 1.1, y: -2 }}
            whileTap={{ scale: 0.9 }}
            variants={{
              hover: { boxShadow: "0 10px 25px rgba(239, 68, 68, 0.3)" }
            }}
          >
            <Minus className="h-6 w-6" />
          </motion.button>
          
          <motion.button
            onClick={handleIncrement}
            className="p-4 bg-green-500/10 text-green-500 rounded-full hover:bg-green-500/20 transition-all duration-200 shadow-lg"
            whileHover={{ scale: 1.1, y: -2 }}
            whileTap={{ scale: 0.9 }}
            variants={{
              hover: { boxShadow: "0 10px 25px rgba(34, 197, 94, 0.3)" }
            }}
          >
            <Plus className="h-6 w-6" />
          </motion.button>
        </div>

        {/* Homophones section */}
        {word.homophones.length > 0 && (
          <motion.div
            className="border-t border-border pt-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center space-x-2 mb-3">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Also listening for:</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {word.homophones.map((homophone, idx) => (
                <motion.span
                  key={idx}
                  className="px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-sm font-medium border border-border/50 hover:bg-muted/80 transition-colors"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + (idx * 0.1) }}
                  whileHover={{ scale: 1.05 }}
                >
                  {homophone}
                </motion.span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Recent activity timeline */}
        {recentHistory.length > 0 && (
          <motion.div
            className="border-t border-border pt-4 mt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <p className="text-xs text-muted-foreground mb-2">Recent activity</p>
            <div className="flex space-x-1">
              {recentHistory.map((_, idx) => (
                <motion.div
                  key={idx}
                  className="w-2 h-2 bg-green-500 rounded-full"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.7 + (idx * 0.1) }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default EnhancedTallyCard;
