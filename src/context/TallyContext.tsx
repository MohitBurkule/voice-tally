import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useUndoRedo } from '../hooks/useUndoRedo';

export interface TargetWord {
  id: string;
  word: string;
  homophones: string[];
  count: number;
  color: string;
}

export interface HistoryItem {
  id: string;
  word: string;
  detectedWord: string;
  timestamp: Date;
  audioBlob?: Blob;
}

export interface TallyState {
  targetWords: TargetWord[];
  history: HistoryItem[];
  isListening: boolean;
  isRecording: boolean;
  currentTranscript: string;
  error: string | null;
  settings: {
    theme: 'light' | 'dark';
    soundEnabled: boolean;
    confidenceThreshold: number;
  };
}

const initialState: TallyState = {
  targetWords: [
    {
      id: '1',
      word: 'hello',
      homophones: ['halo', 'helo'],
      count: 0,
      color: '#3b82f6'
    },
    {
      id: '2',
      word: 'world',
      homophones: ['word', 'whirled'],
      count: 0,
      color: '#10b981'
    },
    {
      id: '3',
      word: 'react',
      homophones: ['ract', 'reakt'],
      count: 0,
      color: '#f59e0b'
    }
  ],
  history: [],
  isListening: false,
  isRecording: false,
  currentTranscript: '',
  error: null,
  settings: {
    theme: 'light',
    soundEnabled: true,
    confidenceThreshold: 0.7
  }
};

type TallyAction =
  | { type: 'SET_LISTENING'; payload: boolean }
  | { type: 'SET_RECORDING'; payload: boolean }
  | { type: 'SET_TRANSCRIPT'; payload: string }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'INCREMENT_WORD'; payload: { wordId: string; detectedWord: string; audioBlob?: Blob } }
  | { type: 'DECREMENT_WORD'; payload: string }
  | { type: 'RESET_WORD'; payload: string }
  | { type: 'RESET_ALL' }
  | { type: 'ADD_TARGET_WORD'; payload: Omit<TargetWord, 'id' | 'count'> }
  | { type: 'REMOVE_TARGET_WORD'; payload: string }
  | { type: 'UPDATE_TARGET_WORD'; payload: TargetWord }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<TallyState['settings']> }
  | { type: 'CLEAR_HISTORY' };

function tallyReducer(state: TallyState, action: TallyAction): TallyState {
  console.log('Reducer called with action:', action.type, action.payload);
  
  switch (action.type) {
    case 'SET_LISTENING':
      return { ...state, isListening: action.payload };
    
    case 'SET_RECORDING':
      return { ...state, isRecording: action.payload };
    
    case 'SET_TRANSCRIPT':
      return { ...state, currentTranscript: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    
    case 'INCREMENT_WORD': {
      const { wordId, detectedWord, audioBlob } = action.payload;
      
      console.log('INCREMENT_WORD called with:', { wordId, detectedWord });
      console.log('Current state before increment:', state.targetWords.map(w => ({ id: w.id, word: w.word, count: w.count })));
      
      const newState = {
        ...state,
        targetWords: state.targetWords.map(word => {
          if (word.id === wordId) {
            console.log(`Incrementing word "${word.word}" from ${word.count} to ${word.count + 1}`);
            return { ...word, count: word.count + 1 };
          }
          return word;
        }),
        history: [
          ...state.history,
          {
            id: Date.now().toString(),
            wordId,
            detectedWord,
            timestamp: new Date(),
            audioBlob
          }
        ]
      };
      
      console.log('New state after increment:', newState.targetWords.map(w => ({ id: w.id, word: w.word, count: w.count })));
      return newState;
    }
    
    case 'DECREMENT_WORD':
      return {
        ...state,
        targetWords: state.targetWords.map(word =>
          word.id === action.payload
            ? { ...word, count: Math.max(0, word.count - 1) }
            : word
        )
      };
    
    case 'RESET_WORD':
      return {
        ...state,
        targetWords: state.targetWords.map(word =>
          word.id === action.payload
            ? { ...word, count: 0 }
            : word
        )
      };
    
    case 'RESET_ALL':
      return {
        ...state,
        targetWords: state.targetWords.map(word => ({ ...word, count: 0 })),
        history: []
      };
    
    case 'ADD_TARGET_WORD': {
      const newWord: TargetWord = {
        ...action.payload,
        id: Date.now().toString(),
        count: 0
      };
      return {
        ...state,
        targetWords: [...state.targetWords, newWord]
      };
    }
    
    case 'REMOVE_TARGET_WORD':
      return {
        ...state,
        targetWords: state.targetWords.filter(word => word.id !== action.payload)
      };
    
    case 'UPDATE_TARGET_WORD':
      return {
        ...state,
        targetWords: state.targetWords.map(word =>
          word.id === action.payload.id ? action.payload : word
        )
      };
    
    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: { ...state.settings, ...action.payload }
      };
    
    case 'CLEAR_HISTORY':
      return {
        ...state,
        history: []
      };
    
    default:
      return state;
  }
}

interface TallyContextType {
  state: TallyState;
  dispatch: React.Dispatch<TallyAction>;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const TallyContext = createContext<TallyContextType | undefined>(undefined);

export const TallyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [storedState, setStoredState] = useLocalStorage('voiceTallyState', initialState);
  const [state, dispatch] = useReducer(tallyReducer, storedState);
  const { present, undo, redo, canUndo, canRedo, set } = useUndoRedo(state);

  // Update localStorage when state changes
  useEffect(() => {
    setStoredState(present);
  }, [present, setStoredState]);

  // Apply theme changes
  useEffect(() => {
    if (present.settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [present.settings.theme]);

  // Sync the undo/redo state with the reducer state
  useEffect(() => {
    set(state);
  }, [state, set]);

  return (
    <TallyContext.Provider
      value={{
        state: present,
        dispatch, // Use the original dispatch, not wrappedDispatch
        undo,
        redo,
        canUndo,
        canRedo
      }}
    >
      {children}
    </TallyContext.Provider>
  );
};

export const useTally = () => {
  const context = useContext(TallyContext);
  if (context === undefined) {
    throw new Error('useTally must be used within a TallyProvider');
  }
  return context;
};