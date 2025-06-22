
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTally } from '../context/TallyContext';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  browserSupportsSpeechRecognition: boolean;
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
    
    for (const targetWord of state.targetWords) {
      const allWords = [targetWord.word, ...targetWord.homophones].map(w => w.toLowerCase());
      
      for (const word of allWords) {
        if (lowerText.includes(word)) {
          console.log('Target word detected:', word);
          playBeepSound();
          
          const currentAudioBlob = audioChunksRef.current.length > 0 
            ? new Blob(audioChunksRef.current, { type: 'audio/webm' })
            : undefined;
          
          dispatch({
            type: 'INCREMENT_WORD',
            payload: {
              wordId: targetWord.id,
              detectedWord: word,
              audioBlob: currentAudioBlob
            }
          });
          
          // Clear audio chunks after use
          audioChunksRef.current = [];
          return;
        }
      }
    }
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
        console.log('Final transcript:', fullTranscript);
        setTranscript(fullTranscript);
        dispatch({ type: 'SET_TRANSCRIPT', payload: fullTranscript });
        checkForTargetWords(fullTranscript);
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
      }
    };
    
    recognition.onend = () => {
      console.log('Speech recognition ended, shouldRestart:', shouldRestartRef.current);
      
      if (!shouldRestartRef.current || isStoppingRef.current) {
        console.log('Not restarting speech recognition');
        setIsListening(false);
        dispatch({ type: 'SET_LISTENING', payload: false });
        stopAudioRecording();
        return;
      }
      
      // Auto-restart after a short delay to prevent rapid cycling
      setTimeout(() => {
        if (shouldRestartRef.current && !isStoppingRef.current && recognitionRef.current) {
          try {
            console.log('Auto-restarting speech recognition');
            recognitionRef.current.start();
          } catch (err) {
            console.error('Error restarting recognition:', err);
            shouldRestartRef.current = false;
            setIsListening(false);
            dispatch({ type: 'SET_LISTENING', payload: false });
            stopAudioRecording();
          }
        }
      }, 500);
    };
    
    try {
      console.log('Starting speech recognition...');
      recognition.start();
    } catch (err) {
      const errorMessage = `Failed to start speech recognition: ${err}`;
      console.error(errorMessage);
      setError(errorMessage);
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  }, [browserSupportsSpeechRecognition, dispatch, checkForTargetWords, startAudioRecording, stopAudioRecording, isListening]);

  const stopListening = useCallback(() => {
    console.log('Stop listening called');
    shouldRestartRef.current = false;
    isStoppingRef.current = true;
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    
    stopAudioRecording();
    setIsListening(false);
    dispatch({ type: 'SET_LISTENING', payload: false });
    
    // Reset stopping flag after a delay
    setTimeout(() => {
      isStoppingRef.current = false;
    }, 1000);
  }, [stopAudioRecording, dispatch]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    dispatch({ type: 'SET_TRANSCRIPT', payload: '' });
  }, [dispatch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldRestartRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      stopAudioRecording();
    };
  }, [stopAudioRecording]);

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
