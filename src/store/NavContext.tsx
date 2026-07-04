import { createContext, useContext } from 'react';
import type { Tab } from '../components/layout/Shell';

export const NavContext = createContext<(tab: Tab) => void>(() => {});

export function useNavigate() {
  return useContext(NavContext);
}
