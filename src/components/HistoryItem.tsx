
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Volume2 } from 'lucide-react';
import { HistoryItem as HistoryItemType } from '../context/TallyContext';
import { format } from 'date-fns';

interface HistoryItemProps {
  item: HistoryItemType;
  index: number;
}

const HistoryItem: React.FC<HistoryItemProps> = ({ item, index }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  const handlePlayAudio = () => {
    if (!item.audioBlob) return;

    if (isPlaying && audio) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    if (audio) {
      audio.play();
      setIsPlaying(true);
      return;
    }

    const audioUrl = URL.createObjectURL(item.audioBlob);
    const newAudio = new Audio(audioUrl);
    
    newAudio.onended = () => {
      setIsPlaying(false);
      URL.revokeObjectURL(audioUrl);
    };
    
    newAudio.onpause = () => {
      setIsPlaying(false);
    };
    
    setAudio(newAudio);
    newAudio.play();
    setIsPlaying(true);
  };

  React.useEffect(() => {
    return () => {
      if (audio) {
        audio.pause();
        audio.src = '';
      }
    };
  }, [audio]);

  return (
    <motion.div
      className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-all duration-200"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      whileHover={{ scale: 1.01 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <h3 className="font-semibold text-card-foreground">
              {item.word}
            </h3>
            {item.detectedWord !== item.word && (
              <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
                heard as "{item.detectedWord}"
              </span>
            )}
          </div>
          
          <p className="text-sm text-muted-foreground">
            {format(new Date(item.timestamp), 'PPp')}
          </p>
        </div>

        {item.audioBlob && (
          <motion.button
            onClick={handlePlayAudio}
            className="p-2 bg-primary/10 text-primary rounded-full hover:bg-primary/20 transition-all duration-200"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title={isPlaying ? 'Pause audio' : 'Play audio'}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </motion.button>
        )}
        
        {!item.audioBlob && (
          <div className="p-2 text-muted-foreground">
            <Volume2 className="h-4 w-4 opacity-30" />
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default HistoryItem;
