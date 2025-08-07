
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, AlertCircle, Radio, Volume2, Zap } from 'lucide-react';
import { useTally } from '../context/TallyContext';

const EnhancedStatusIndicator: React.FC<{ confidence?: number }> = ({ confidence = 0 }) => {
  const { state } = useTally();

  const getStatusConfig = () => {
    if (state.error) {
      return {
        icon: AlertCircle,
        text: 'Error Detected',
        subtext: state.error,
        color: 'text-destructive',
        bgColor: 'bg-destructive/10',
        borderColor: 'border-destructive/30',
        pulseColor: 'bg-destructive/20'
      };
    }
    
    if (state.isListening) {
      const confidenceLevel = confidence > 0.8 ? 'Excellent' : confidence > 0.6 ? 'Good' : confidence > 0.4 ? 'Fair' : 'Low';
      return {
        icon: Mic,
        text: 'Listening Actively',
        subtext: state.currentTranscript || `Ready to detect speech (${confidenceLevel} quality)`,
        color: 'text-primary',
        bgColor: 'bg-primary/10',
        borderColor: 'border-primary/30',
        pulseColor: 'bg-primary/20',
        animate: true,
        confidence: confidence
      };
    }
    
    if (state.isRecording) {
      return {
        icon: Radio,
        text: 'Recording Audio',
        subtext: 'Capturing high-quality audio...',
        color: 'text-orange-500',
        bgColor: 'bg-orange-500/10',
        borderColor: 'border-orange-500/30',
        pulseColor: 'bg-orange-500/20'
      };
    }
    
    return {
      icon: MicOff,
      text: 'Ready to Start',
      subtext: 'Click "Start Listening" to begin voice detection',
      color: 'text-muted-foreground',
      bgColor: 'bg-muted/20',
      borderColor: 'border-muted/30'
    };
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <motion.div
      className={`relative p-8 rounded-2xl border-2 ${config.bgColor} ${config.borderColor} transition-all duration-500 overflow-hidden`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, type: "spring", stiffness: 100 }}
    >
      {/* Background pulse animation */}
      {config.animate && (
        <motion.div
          className={`absolute inset-0 ${config.pulseColor} rounded-2xl`}
          animate={{ opacity: [0, 0.3, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      
      <div className="relative flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <motion.div
            className={`relative p-4 rounded-full ${config.bgColor} border ${config.borderColor}`}
            animate={config.animate ? { scale: [1, 1.05, 1] } : {}}
            transition={config.animate ? { duration: 2, repeat: Infinity } : {}}
          >
            <Icon className={`h-8 w-8 ${config.color}`} />
            
            {/* Confidence indicator */}
            {config.confidence !== undefined && config.confidence > 0 && (
              <motion.div
                className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full flex items-center justify-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Zap className="h-2 w-2 text-white" />
              </motion.div>
            )}
          </motion.div>
          
          <div className="flex-1">
            <motion.h3
              className={`text-2xl font-bold ${config.color} mb-1`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {config.text}
            </motion.h3>
            
            <AnimatePresence mode="wait">
              <motion.p
                key={config.subtext}
                className="text-muted-foreground max-w-md"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                {config.subtext}
              </motion.p>
            </AnimatePresence>
            
            {/* Confidence bar */}
            {config.confidence !== undefined && config.confidence > 0 && (
              <motion.div
                className="mt-3 w-48 h-2 bg-muted rounded-full overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <motion.div
                  className={`h-full rounded-full ${
                    config.confidence > 0.8 ? 'bg-green-500' :
                    config.confidence > 0.6 ? 'bg-yellow-500' :
                    config.confidence > 0.4 ? 'bg-orange-500' : 'bg-red-500'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${config.confidence * 100}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </motion.div>
            )}
          </div>
        </div>
        
        {/* Audio visualization */}
        {state.isListening && (
          <motion.div
            className="flex space-x-2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                className={`w-2 rounded-full ${config.color === 'text-primary' ? 'bg-primary' : 'bg-muted-foreground'}`}
                style={{ height: '2rem' }}
                animate={{
                  scaleY: [0.3, 1, 0.3],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: "easeInOut"
                }}
              />
            ))}
          </motion.div>
        )}
        
        {/* Sound icon when recording */}
        {state.isRecording && !state.isListening && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-3 bg-orange-500/20 rounded-full"
          >
            <Volume2 className="h-6 w-6 text-orange-500" />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default EnhancedStatusIndicator;
