import { useState, useRef, useCallback, useEffect } from 'react';
import { useTally } from '../context/TallyContext';

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  browserSupportsSpeechRecognition: boolean;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const { state, dispatch } = useTally();
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const shouldRestartRef = useRef(false);
  const isStoppingRef = useRef(false);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const browserSupportsSpeechRecognition = !!(
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)
  );

  console.log('Speech Recognition Support:', browserSupportsSpeechRecognition);

  const playBeepSound = useCallback(() => {
    if (!state.settings.soundEnabled) return;
    
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (err) {
      console.error('Error playing beep sound:', err);
    }
  }, [state.settings.soundEnabled]);

const checkForTargetWords = useCallback((spokenText: string) => {
  console.log('Checking spoken text:', spokenText);
  const lowerText = spokenText.toLowerCase().trim();
  
  // Don't process empty text
  if (!lowerText) return;
  
  // Track which specific homophones we've already processed to avoid double counting the same homophone
  const processedHomophones = new Set<string>();
  
  for (const targetWord of state.targetWords) {
    console.log('Checking target word:', { id: targetWord.id, word: targetWord.word, count: targetWord.count });
    const allWords = [targetWord.word, ...targetWord.homophones].map(w => w.toLowerCase());
    console.log('Homophones:', allWords);
    
    let totalMatches = 0; // Count total matches for this target word across all its homophones
    
    for (const word of allWords) {
      console.log(`Checking for word: "${word}" in text: "${lowerText}"`);
      
      // Skip if we've already processed this specific homophone
      if (processedHomophones.has(word)) {
        console.log(`Skipping "${word}" - already processed`);
        continue;
      }
      
      // Try multiple matching strategies
      let matches = null;
      let count = 0;
      
      // Strategy 1: Word boundaries (most precise)
      const wordBoundaryRegex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      matches = lowerText.match(wordBoundaryRegex);
      
      if (matches) {
        count = matches.length;
        console.log(`Found ${count} matches using word boundary for "${word}":`, matches);
      } else {
        // Strategy 2: Simple includes check (fallback for edge cases)
        const simpleRegex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        matches = lowerText.match(simpleRegex);
        if (matches) {
          count = matches.length;
          console.log(`Found ${count} matches using simple regex for "${word}":`, matches);
        }
      }
      
      if (count > 0) {
        console.log('Target word detected:', word, 'for target:', targetWord.word, 'with ID:', targetWord.id);
        totalMatches += count;
        
        // Mark this specific homophone as processed
        processedHomophones.add(word);
      }
    }
    
    // Dispatch increments for all matches found for this target word
    if (totalMatches > 0) {
      console.log(`Total matches for target "${targetWord.word}": ${totalMatches}`);
      
      for (let i = 0; i < totalMatches; i++) {
        playBeepSound();
        
        const currentAudioBlob = audioChunksRef.current.length > 0 
          ? new Blob(audioChunksRef.current, { type: 'audio/webm' })
          : undefined;
        
        dispatch({
          type: 'INCREMENT_WORD',
          payload: {
            wordId: targetWord.id,
            detectedWord: targetWord.word, // Use the main target word for consistency
            audioBlob: currentAudioBlob
          }
        });
      }
    }
  }
  
  // Clear audio chunks after processing all words
  audioChunksRef.current = [];
}, [state.targetWords, dispatch, playBeepSound]);

  const startAudioRecording = useCallback(async () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      console.log('Audio recording already active');
      return;
    }

    try {
      console.log('Starting audio recording...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.start(1000);
      dispatch({ type: 'SET_RECORDING', payload: true });
      console.log('Audio recording started');
    } catch (err) {
      console.error('Error starting audio recording:', err);
      setError(`Microphone access denied: ${err}`);
      dispatch({ type: 'SET_ERROR', payload: `Microphone access denied: ${err}` });
    }
  }, [dispatch]);

  const stopAudioRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      console.log('Stopping audio recording...');
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      dispatch({ type: 'SET_RECORDING', payload: false });
      console.log('Audio recording stopped');
    }
  }, [dispatch]);

  const startListening = useCallback(async () => {
    console.log('Start listening called');
    
    if (isListening || isStoppingRef.current) {
      console.log('Already listening or stopping, ignoring start request');
      return;
    }
    
    if (!browserSupportsSpeechRecognition) {
      const errorMsg = 'Speech recognition is not supported in this browser';
      console.error(errorMsg);
      setError(errorMsg);
      dispatch({ type: 'SET_ERROR', payload: errorMsg });
      return;
    }

    try {
      // Request microphone permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone permission granted');
    } catch (err) {
      const errorMsg = `Microphone access denied: ${err}`;
      console.error(errorMsg);
      setError(errorMsg);
      dispatch({ type: 'SET_ERROR', payload: errorMsg });
      return;
    }

    // Clean up any existing recognition first
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.log('Error stopping existing recognition:', err);
      }
      recognitionRef.current = null;
    }

    // Clear any pending restart timeout
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognitionRef.current = recognition;
    shouldRestartRef.current = true;
    isStoppingRef.current = false;
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;
    
    console.log('Speech recognition configured');
    
    recognition.onstart = () => {
      console.log('Speech recognition started');
      setIsListening(true);
      setError(null);
      dispatch({ type: 'SET_LISTENING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });
      startAudioRecording();
    };
    
    recognition.onresult = (event: any) => {
      console.log('Speech recognition result received');
      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPart = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          finalTranscript += transcriptPart;
        }
      }
      
      const fullTranscript = finalTranscript.trim();
      if (fullTranscript) {
        const lowerTranscript = fullTranscript.toLowerCase();
        console.log('Final transcript:', lowerTranscript);
        setTranscript(lowerTranscript);
        dispatch({type: 'SET_TRANSCRIPT', payload: lowerTranscript});
        checkForTargetWords(lowerTranscript);
      }
    };
    
    recognition.onerror = (event: any) => {
      const errorMessage = `Speech recognition error: ${event.error}`;
      console.error(errorMessage, event);
      setError(errorMessage);
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      
      // Don't restart on certain errors
      if (event.error === 'aborted' || event.error === 'not-allowed') {
        shouldRestartRef.current = false;
        console.log('Setting shouldRestart to false due to error:', event.error);
      }
    };
    
    recognition.onend = () => {
      console.log('Speech recognition ended, shouldRestart:', shouldRestartRef.current, 'isStopping:', isStoppingRef.current);
      
      // Always update the listening state first
      setIsListening(false);
      dispatch({ type: 'SET_LISTENING', payload: false });
      stopAudioRecording();
      
      // Only restart if we should and we're not manually stopping
      if (shouldRestartRef.current && !isStoppingRef.current) {
        console.log('Scheduling speech recognition restart');
        restartTimeoutRef.current = setTimeout(() => {
          // Double-check conditions before restarting
          if (shouldRestartRef.current && !isStoppingRef.current && recognitionRef.current) {
            try {
              console.log('Auto-restarting speech recognition');
              recognitionRef.current.start();
            } catch (err) {
              console.error('Error restarting recognition:', err);
              shouldRestartRef.current = false;
              setIsListening(false);
              dispatch({ type: 'SET_LISTENING', payload: false });
              recognitionRef.current = null;
            }
          } else {
            console.log('Not restarting - conditions changed');
            recognitionRef.current = null;
          }
          restartTimeoutRef.current = null;
        }, 500);
      } else {
        console.log('Not restarting speech recognition');
        recognitionRef.current = null;
      }
    };
    
    try {
      console.log('Starting speech recognition...');
      recognition.start();
    } catch (err) {
      const errorMessage = `Failed to start speech recognition: ${err}`;
      console.error(errorMessage);
      setError(errorMessage);
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      
      setIsListening(false);
      dispatch({ type: 'SET_LISTENING', payload: false });
      recognitionRef.current = null;
    }
  }, [browserSupportsSpeechRecognition, dispatch, checkForTargetWords, startAudioRecording, stopAudioRecording, isListening]);

  const stopListening = useCallback(() => {
    console.log('Stop listening called');
    shouldRestartRef.current = false;
    isStoppingRef.current = true;
    
    // Clear any pending restart
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    
    // Stop recognition if it exists
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.log('Error stopping recognition:', err);
      }
      recognitionRef.current = null;
    }
    
    // Stop audio recording
    stopAudioRecording();
    
    // Update state
    setIsListening(false);
    dispatch({ type: 'SET_LISTENING', payload: false });
    
    // Reset stopping flag after a delay
    setTimeout(() => {
      isStoppingRef.current = false;
      console.log('Reset stopping flag');
    }, 1000);
  }, [stopAudioRecording, dispatch]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    dispatch({ type: 'SET_TRANSCRIPT', payload: '' });
  }, [dispatch]);

  // Cleanup on unmount - using empty dependency array to prevent re-creation
  useEffect(() => {
    return () => {
      console.log('Component unmounting - cleaning up');
      shouldRestartRef.current = false;
      
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
      
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {
          console.log('Error stopping recognition during cleanup:', err);
        }
        recognitionRef.current = null;
      }
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []); // Empty dependency array to prevent re-creation

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    resetTranscript,
    browserSupportsSpeechRecognition
  };
}