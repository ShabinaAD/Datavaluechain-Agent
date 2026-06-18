import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ThemeMode } from './types';

/**
 * UI preferences are persisted separately from project data: they have a
 * different lifecycle (device-level, not work-product) and we never want a
 * preferences change to touch the "last saved" status of the user's work.
 */
interface UIState {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

function getSystemTheme(): ThemeMode {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: getSystemTheme(),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'dvcaf.ui',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
