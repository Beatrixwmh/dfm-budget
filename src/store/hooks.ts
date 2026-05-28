import { useContext } from 'react';
import { AppStateContext, AppDispatchContext, IsNewUserContext } from './AppContext';

export function useAppState() {
  return useContext(AppStateContext);
}

export function useAppDispatch() {
  return useContext(AppDispatchContext);
}

export function useIsNewUser() {
  return useContext(IsNewUserContext);
}
