import type { AppState } from '../engine/types';
import { validateAppState } from './validate';

export interface StorageAdapter {
  load(): AppState | null;
  save(state: AppState): void;
  exportJson(): string;
  importJson(json: string): AppState;
}

const STORAGE_KEY = 'dfm-budget-state';

export const localStorageAdapter: StorageAdapter = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return validateAppState(JSON.parse(raw));
    } catch {
      console.warn('Corrupted localStorage data, clearing.');
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  },

  save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save state:', e);
    }
  },

  exportJson() {
    return localStorage.getItem(STORAGE_KEY) ?? '{}';
  },

  importJson(json) {
    const parsed = JSON.parse(json);
    return validateAppState(parsed);
  },
};
