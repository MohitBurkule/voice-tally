
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
    const lowerText = spokenText.toLowerCase();
    
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
          
          audioChunksRef.current = [];
          return;
        }
      }
    }
  }, [state.targetWords, dispatch, playBeepSound]);

  const startAudioRecording = useCallback(async () => {
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
    console.log('Stopping audio recording...');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      dispatch({ type: 'SET_RECORDING', payload: false });
      console.log('Audio recording stopped');
    }
  }, [dispatch]);

  const startListening = useCallback(async () => {
    console.log('Start listening called');
    
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
      console.log('Transcript:', fullTranscript);
      setTranscript(fullTranscript);
      dispatch({ type: 'SET_TRANSCRIPT', payload: fullTranscript });
      
      if (finalTranscript) {
        checkForTargetWords(finalTranscript);
      }
    };
    
    recognition.onerror = (event: any) => {
      const errorMessage = `Speech recognition error: ${event.error}`;
      console.error(errorMessage, event);
      setError(errorMessage);
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      setIsListening(false);
      dispatch({ type: 'SET_LISTENING', payload: false });
      stopAudioRecording();
    };
    
    recognition.onend = () => {
      console.log('Speech recognition ended');
      setIsListening(false);
      dispatch({ type: 'SET_LISTENING', payload: false });
      stopAudioRecording();
      
      // Auto-restart if we're supposed to be listening (unless there was an error)
      if (!error && recognitionRef.current) {
        console.log('Auto-restarting speech recognition');
        setTimeout(() => {
          if (recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (err) {
              console.error('Error restarting recognition:', err);
            }
          }
        }, 100);
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
    }
  }, [browserSupportsSpeechRecognition, dispatch, checkForTargetWords, startAudioRecording, stopAudioRecording, error]);

  const stopListening = useCallback(() => {
    console.log('Stop listening called');
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    stopAudioRecording();
    setIsListening(false);
    dispatch({ type: 'SET_LISTENING', payload: false });
  }, [stopAudioRecording, dispatch]);

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
