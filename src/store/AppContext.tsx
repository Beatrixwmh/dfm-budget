import { createContext, useReducer, useEffect, useRef, type ReactNode } from 'react';
import type { AppState } from '../engine/types';
import type { AppAction } from './actions';
import { appReducer } from './reducer';
import { createDefaultState } from './defaults';
import { localStorageAdapter } from '../persistence/storage';

export const AppStateContext = createContext<AppState>(null!);
export const AppDispatchContext = createContext<React.Dispatch<AppAction>>(null!);
export const IsNewUserContext = createContext<boolean>(false);

export function AppProvider({ children }: { children: ReactNode }) {
  const loaded = useRef(localStorageAdapter.load());
  const isNew = loaded.current === null;
  const initial = loaded.current ?? createDefaultState();

  const [state, dispatch] = useReducer(appReducer, initial);

  useEffect(() => {
    localStorageAdapter.save(state);
  }, [state]);

  return (
    <AppStateContext value={state}>
      <AppDispatchContext value={dispatch}>
        <IsNewUserContext value={isNew}>
          {children}
        </IsNewUserContext>
      </AppDispatchContext>
    </AppStateContext>
  );
}
