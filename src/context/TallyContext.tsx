import React, { createContext, useContext, useReducer, useEffect, useRef, useMemo } from 'react';
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
  wordId: string;
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

let historyIdCounter = 0;
const makeHistoryId = (): string => {
  try {
    if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
      return (crypto as any).randomUUID();
    }
  } catch (_) {}
  historyIdCounter = (historyIdCounter + 1) % 1_000_000;
  return `${Date.now()}-${historyIdCounter}`;
};

function tallyReducer(state: TallyState, action: TallyAction): TallyState {
  switch (action.type) {
    case 'SET_LISTENING':
      if (state.isListening === action.payload) return state;
      return { ...state, isListening: action.payload };

    case 'SET_RECORDING':
      if (state.isRecording === action.payload) return state;
      return { ...state, isRecording: action.payload };

    case 'SET_TRANSCRIPT':
      if (state.currentTranscript === action.payload) return state;
      return { ...state, currentTranscript: action.payload };

    case 'SET_ERROR':
      if (state.error === action.payload) return state;
      return { ...state, error: action.payload };

    case 'INCREMENT_WORD': {
      const { wordId, detectedWord, audioBlob } = action.payload;
      const targetWord = state.targetWords.find(w => w.id === wordId);
      if (!targetWord) return state;

      return {
        ...state,
        targetWords: state.targetWords.map(word =>
          word.id === wordId ? { ...word, count: word.count + 1 } : word
        ),
        history: [
          ...state.history,
          {
            id: makeHistoryId(),
            wordId,
            word: targetWord.word,
            detectedWord,
            timestamp: new Date(),
            audioBlob,
          },
        ],
      };
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

// Runtime fields are not persisted and not part of undo/redo history.
const RUNTIME_DEFAULTS = {
  isListening: false,
  isRecording: false,
  currentTranscript: '',
  error: null as string | null,
};

const hydrateState = (stored: Partial<TallyState> | null): TallyState => {
  const base = stored && typeof stored === 'object'
    ? { ...initialState, ...stored }
    : { ...initialState };
  // Always start fresh on runtime fields, regardless of what was stored
  // (older versions of this app persisted runtime state)
  return {
    ...base,
    ...RUNTIME_DEFAULTS,
    history: Array.isArray(base.history)
      // Date objects don't survive JSON.stringify — rehydrate them
      ? base.history.map(h => ({ ...h, timestamp: new Date(h.timestamp) }))
      : [],
  };
};

const stripRuntime = (s: TallyState): Omit<TallyState, keyof typeof RUNTIME_DEFAULTS> => {
  const { isListening, isRecording, currentTranscript, error, ...durable } = s;
  return durable;
};

export const TallyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [storedState, setStoredState] = useLocalStorage<Partial<TallyState>>(
    'voiceTallyState',
    stripRuntime(initialState),
  );
  const [state, dispatch] = useReducer(tallyReducer, storedState, hydrateState);
  const { present, undo, redo, canUndo, canRedo, set } = useUndoRedo(state);

  // Persist only durable fields — runtime state is per-session
  useEffect(() => {
    setStoredState(stripRuntime(present));
  }, [present, setStoredState]);

  // Apply theme changes
  useEffect(() => {
    if (present.settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [present.settings.theme]);

  // Sync reducer state into undo/redo journal — but ONLY when durable fields
  // change. Otherwise every interim transcript update would push a past entry,
  // bloating memory + localStorage and making undo meaningless.
  const lastDurableRef = useRef({
    targetWords: state.targetWords,
    history: state.history,
    settings: state.settings,
  });
  useEffect(() => {
    const changed =
      state.targetWords !== lastDurableRef.current.targetWords ||
      state.history !== lastDurableRef.current.history ||
      state.settings !== lastDurableRef.current.settings;
    if (changed) {
      set(state);
      lastDurableRef.current = {
        targetWords: state.targetWords,
        history: state.history,
        settings: state.settings,
      };
    }
  }, [state, set]);

  // Expose merged view: durable fields from undo/redo's `present`,
  // runtime fields direct from reducer (so they're always live).
  const exposedState: TallyState = useMemo(() => ({
    ...present,
    isListening: state.isListening,
    isRecording: state.isRecording,
    currentTranscript: state.currentTranscript,
    error: state.error,
  }), [present, state.isListening, state.isRecording, state.currentTranscript, state.error]);

  return (
    <TallyContext.Provider
      value={{
        state: exposedState,
        dispatch,
        undo,
        redo,
        canUndo,
        canRedo,
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
