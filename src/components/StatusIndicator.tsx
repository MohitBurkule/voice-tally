
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, AlertCircle, Radio } from 'lucide-react';
import { useTally } from '../context/TallyContext';

const StatusIndicator: React.FC = () => {
  const { state } = useTally();

  const getStatusConfig = () => {
    if (state.error) {
      return {
        icon: AlertCircle,
        text: 'Error',
        subtext: state.error,
        color: 'text-destructive',
        bgColor: 'bg-destructive/10',
        borderColor: 'border-destructive/20'
      };
    }
    
    if (state.isListening) {
      return {
        icon: Mic,
        text: 'Listening...',
        subtext: state.currentTranscript || 'Speak now',
        color: 'text-listening',
        bgColor: 'bg-listening/10',
        borderColor: 'border-listening/20',
        animate: true
      };
    }
    
    if (state.isRecording) {
      return {
        icon: Radio,
        text: 'Recording',
        subtext: 'Audio being captured',
        color: 'text-warning',
        bgColor: 'bg-warning/10',
        borderColor: 'border-warning/20'
      };
    }
    
    return {
      icon: MicOff,
      text: 'Idle',
      subtext: 'Ready to listen',
      color: 'text-muted-foreground',
      bgColor: 'bg-muted/50',
      borderColor: 'border-muted'
    };
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <motion.div
      className={`p-6 rounded-xl border-2 ${config.bgColor} ${config.borderColor} transition-all duration-300`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center space-x-4">
        <motion.div
          className={`p-3 rounded-full ${config.bgColor}`}
          animate={config.animate ? { scale: [1, 1.1, 1] } : {}}
          transition={config.animate ? { duration: 2, repeat: Infinity } : {}}
        >
          <Icon className={`h-6 w-6 ${config.color}`} />
        </motion.div>
        
        <div className="flex-1">
          <motion.h3
            className={`text-lg font-semibold ${config.color}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {config.text}
          </motion.h3>
          
          <AnimatePresence mode="wait">
            <motion.p
              key={config.subtext}
              className="text-sm text-muted-foreground mt-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {config.subtext}
            </motion.p>
          </AnimatePresence>
        </div>
        
        {state.isListening && (
          <motion.div
            className="flex space-x-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-1 h-8 bg-listening rounded-full"
                animate={{
                  scaleY: [0.3, 1, 0.3],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default StatusIndicator;
