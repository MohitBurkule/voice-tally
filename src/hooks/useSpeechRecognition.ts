
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

  const browserSupportsSpeechRecognition = !!(
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)
  );

  const playBeepSound = useCallback(() => {
    if (!state.settings.soundEnabled) return;
    
    // Create a simple beep using Web Audio API
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
  }, [state.settings.soundEnabled]);

  const checkForTargetWords = useCallback((spokenText: string) => {
    const lowerText = spokenText.toLowerCase();
    
    for (const targetWord of state.targetWords) {
      const allWords = [targetWord.word, ...targetWord.homophones].map(w => w.toLowerCase());
      
      for (const word of allWords) {
        if (lowerText.includes(word)) {
          playBeepSound();
          
          // Get the current audio recording if available
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
          
          // Clear audio chunks for next recording
          audioChunksRef.current = [];
          return;
        }
      }
    }
  }, [state.targetWords, dispatch, playBeepSound]);

  const startAudioRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.start(1000); // Collect data every second
      dispatch({ type: 'SET_RECORDING', payload: true });
    } catch (err) {
      console.error('Error starting audio recording:', err);
    }
  }, [dispatch]);

  const stopAudioRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      dispatch({ type: 'SET_RECORDING', payload: false });
    }
  }, [dispatch]);

  const startListening = useCallback(() => {
    if (!browserSupportsSpeechRecognition) {
      setError('Speech recognition is not supported in this browser');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognitionRef.current = recognition;
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      dispatch({ type: 'SET_LISTENING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });
      startAudioRecording();
    };
    
    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPart = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          finalTranscript += transcriptPart;
        } else {
          interimTranscript += transcriptPart;
        }
      }
      
      const fullTranscript = finalTranscript || interimTranscript;
      setTranscript(fullTranscript);
      dispatch({ type: 'SET_TRANSCRIPT', payload: fullTranscript });
      
      if (finalTranscript) {
        checkForTargetWords(finalTranscript);
      }
    };
    
    recognition.onerror = (event: any) => {
      const errorMessage = `Speech recognition error: ${event.error}`;
      setError(errorMessage);
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      setIsListening(false);
      dispatch({ type: 'SET_LISTENING', payload: false });
      stopAudioRecording();
    };
    
    recognition.onend = () => {
      setIsListening(false);
      dispatch({ type: 'SET_LISTENING', payload: false });
      stopAudioRecording();
    };
    
    try {
      recognition.start();
    } catch (err) {
      const errorMessage = 'Failed to start speech recognition';
      setError(errorMessage);
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  }, [browserSupportsSpeechRecognition, dispatch, checkForTargetWords, startAudioRecording, stopAudioRecording]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    stopAudioRecording();
  }, [stopAudioRecording]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    dispatch({ type: 'SET_TRANSCRIPT', payload: '' });
  }, [dispatch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
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
