
import { useState, useCallback } from 'react';

interface UseUndoRedoReturn<T> {
  present: T;
  past: T[];
  future: T[];
  undo: () => void;
  redo: () => void;
  set: (newState: T) => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useUndoRedo<T>(initialState: T): UseUndoRedoReturn<T> {
  const [state, setState] = useState({
    past: [] as T[],
    present: initialState,
    future: [] as T[]
  });

  const canUndo = state.past.length !== 0;
  const canRedo = state.future.length !== 0;

  const undo = useCallback(() => {
    setState(currentState => {
      const { past, present, future } = currentState;
      
      if (past.length === 0) return currentState;

      const previous = past[past.length - 1];
      const newPast = past.slice(0, past.length - 1);

      return {
        past: newPast,
        present: previous,
        future: [present, ...future]
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState(currentState => {
      const { past, present, future } = currentState;
      
      if (future.length === 0) return currentState;

      const next = future[0];
      const newFuture = future.slice(1);

      return {
        past: [...past, present],
        present: next,
        future: newFuture
      };
    });
  }, []);

  const set = useCallback((newState: T) => {
    setState(currentState => ({
      past: [...currentState.past, currentState.present],
      present: newState,
      future: []
    }));
  }, []);

  return {
    present: state.present,
    past: state.past,
    future: state.future,
    undo,
    redo,
    set,
    canUndo,
    canRedo
  };
}
