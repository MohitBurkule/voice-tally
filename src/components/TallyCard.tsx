
import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus, RotateCcw } from 'lucide-react';
import { TargetWord } from '../context/TallyContext';
import { useTally } from '../context/TallyContext';

interface TallyCardProps {
  word: TargetWord;
  index: number;
}

const TallyCard: React.FC<TallyCardProps> = ({ word, index }) => {
  const { dispatch } = useTally();
  const [isFlipping, setIsFlipping] = React.useState(false);
  const prevCount = React.useRef(word.count);

  React.useEffect(() => {
    if (word.count !== prevCount.current) {
      setIsFlipping(true);
      const timer = setTimeout(() => setIsFlipping(false), 600);
      prevCount.current = word.count;
      return () => clearTimeout(timer);
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

  return (
    <motion.div
      className="bg-card border border-border rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300"
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: 0.5, 
        delay: index * 0.1,
        type: "spring",
        stiffness: 100
      }}
      whileHover={{ y: -5, scale: 1.02 }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: word.color }}
          />
          <h3 className="text-xl font-bold text-card-foreground">{word.word}</h3>
        </div>
        
        <motion.button
          onClick={handleReset}
          className="p-2 text-muted-foreground hover:text-destructive transition-colors duration-200 rounded-lg hover:bg-destructive/10"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title="Reset count"
        >
          <RotateCcw className="h-4 w-4" />
        </motion.button>
      </div>

      <div className="text-center mb-6">
        <motion.div
          className={`text-6xl font-bold text-card-foreground ${isFlipping ? 'animate-count-flip' : ''}`}
          style={{ color: word.color }}
          key={word.count}
        >
          {word.count}
        </motion.div>
        <p className="text-sm text-muted-foreground mt-2">
          Total detections
        </p>
      </div>

      <div className="flex items-center justify-center space-x-4 mb-4">
        <motion.button
          onClick={handleDecrement}
          disabled={word.count === 0}
          className="p-3 bg-destructive/10 text-destructive rounded-full hover:bg-destructive/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <Minus className="h-5 w-5" />
        </motion.button>
        
        <motion.button
          onClick={handleIncrement}
          className="p-3 bg-success/10 text-success rounded-full hover:bg-success/20 transition-all duration-200"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <Plus className="h-5 w-5" />
        </motion.button>
      </div>

      {word.homophones.length > 0 && (
        <div className="border-t border-border pt-4">
          <p className="text-xs text-muted-foreground mb-2">Also listening for:</p>
          <div className="flex flex-wrap gap-2">
            {word.homophones.map((homophone, idx) => (
              <motion.span
                key={idx}
                className="px-2 py-1 bg-muted text-muted-foreground rounded-md text-xs"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: (index * 0.1) + (idx * 0.05) }}
              >
                {homophone}
              </motion.span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default TallyCard;
