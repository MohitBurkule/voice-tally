
import { useState, useRef, useCallback, useEffect } from 'react';
import { useTally } from '../context/TallyContext';

interface UseAdvancedSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  confidence: number;
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

export function useAdvancedSpeechRecognition(): UseAdvancedSpeechRecognitionReturn {
  const { state, dispatch } = useTally();
  const [transcript, setTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isActiveRef = useRef(false);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef('');
  const errorRef = useRef<string | null>(null);

  const browserSupportsSpeechRecognition = !!(
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)
  );

  const playNotificationSound = useCallback(() => {
    if (!state.settings.soundEnabled) return;
    
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (err) {
      console.warn('Audio notification failed:', err);
    }
  }, [state.settings.soundEnabled]);

  const processTranscript = useCallback((text: string, confidence: number) => {
    if (!text.trim() || confidence < state.settings.confidenceThreshold) return;
    
    const lowerText = text.toLowerCase().trim();
    console.log('Processing transcript:', lowerText, 'confidence:', confidence);
    
    // Process each target word independently
    for (const targetWord of state.targetWords) {
      const searchTerms = [targetWord.word.toLowerCase(), ...targetWord.homophones.map(h => h.toLowerCase())];
      
      for (const term of searchTerms) {
        const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        const matches = lowerText.match(regex);
        
        if (matches?.length) {
          console.log(`Detected "${term}" for target "${targetWord.word}" - ${matches.length} times`);
          
          // Process each match
          for (let i = 0; i < matches.length; i++) {
            playNotificationSound();
            
            const audioBlob = audioChunksRef.current.length > 0 
              ? new Blob(audioChunksRef.current, { type: 'audio/webm' })
              : undefined;
            
            dispatch({
              type: 'INCREMENT_WORD',
              payload: {
                wordId: targetWord.id,
                detectedWord: term,
                audioBlob
              }
            });
          }
          
          // Clear processed audio chunks after successful detection
          audioChunksRef.current = [];
          break; // Move to next target word after finding a match
        }
      }
    }
  }, [state.targetWords, state.settings.confidenceThreshold, dispatch, playNotificationSound]);

  const startAudioRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        } 
      });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.start(100); // Collect data every 100ms for better responsiveness
      dispatch({ type: 'SET_RECORDING', payload: true });
      
    } catch (err) {
      console.error('Audio recording failed:', err);
      setError(`Microphone access failed: ${err}`);
      dispatch({ type: 'SET_ERROR', payload: `Microphone access failed: ${err}` });
    }
  }, [dispatch]);

  const stopAudioRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream?.getTracks().forEach(track => track.stop());
      dispatch({ type: 'SET_RECORDING', payload: false });
    }
  }, [dispatch]);

  const setErrorWithRef = useCallback((msg: string | null) => {
    errorRef.current = msg;
    setError(msg);
    dispatch({ type: 'SET_ERROR', payload: msg });
  }, [dispatch]);

  const createRecognitionInstance = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      console.log('Speech recognition started successfully');
      setIsListening(true);
      setErrorWithRef(null);
      dispatch({ type: 'SET_LISTENING', payload: true });
      startAudioRecording();
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence || 0.8;

        if (result.isFinal) {
          finalTranscriptRef.current += transcript;
          processTranscript(transcript, confidence);
        } else {
          interimTranscript += transcript;
        }
      }

      const currentTranscript = finalTranscriptRef.current + interimTranscript;
      setTranscript(currentTranscript);
      setConfidence(event.results[event.results.length - 1]?.[0]?.confidence || 0);
      dispatch({ type: 'SET_TRANSCRIPT', payload: currentTranscript });
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);

      // Non-errors: silence and programmatic stop — just let onend handle restart
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setErrorWithRef('Microphone permission denied');
        isActiveRef.current = false;
        return;
      }

      if (event.error === 'network') {
        setErrorWithRef('Network error - please check your connection');
        isActiveRef.current = false;
        return;
      }

      // Audio capture errors — mark so onend doesn't restart on fatal errors
      if (event.error === 'audio-capture') {
        setErrorWithRef('No microphone detected');
        isActiveRef.current = false;
        return;
      }

      console.log('Will attempt to restart after error:', event.error);
    };

    recognition.onend = () => {
      console.log('Speech recognition ended, isActive:', isActiveRef.current);

      setIsListening(false);
      dispatch({ type: 'SET_LISTENING', payload: false });
      stopAudioRecording();

      // Auto-restart if still active and no fatal error
      if (isActiveRef.current && !errorRef.current) {
        restartTimeoutRef.current = setTimeout(() => {
          if (isActiveRef.current && !errorRef.current) {
            console.log('Auto-restarting speech recognition');
            try {
              const newRecognition = createRecognitionInstance();
              recognitionRef.current = newRecognition;
              newRecognition.start();
            } catch (err) {
              console.error('Failed to restart recognition:', err);
              isActiveRef.current = false;
            }
          }
        }, 300);
      }
    };

    return recognition;
  }, [dispatch, processTranscript, startAudioRecording, stopAudioRecording, setErrorWithRef]);

  const startListening = useCallback(async () => {
    if (!browserSupportsSpeechRecognition || isActiveRef.current) return;

    try {
      // Request permissions and immediately release the stream
      const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      permissionStream.getTracks().forEach(track => track.stop());

      // Clear any existing timeouts
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }

      // Stop existing recognition
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (_) {}
        recognitionRef.current = null;
      }

      const recognition = createRecognitionInstance();
      recognitionRef.current = recognition;
      isActiveRef.current = true;
      errorRef.current = null;
      finalTranscriptRef.current = '';

      recognition.start();

    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setErrorWithRef(`Failed to start: ${err}`);
      isActiveRef.current = false;
    }
  }, [browserSupportsSpeechRecognition, createRecognitionInstance, setErrorWithRef]);

  const stopListening = useCallback(() => {
    console.log('Stopping speech recognition');
    isActiveRef.current = false;
    
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    
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
    finalTranscriptRef.current = '';
    dispatch({ type: 'SET_TRANSCRIPT', payload: '' });
  }, [dispatch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream?.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return {
    isListening,
    transcript,
    confidence,
    error,
    startListening,
    stopListening,
    resetTranscript,
    browserSupportsSpeechRecognition
  };
}
