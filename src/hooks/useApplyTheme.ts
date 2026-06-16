import { useEffect } from 'react';
import { useUIStore } from '../store/uiStore';

/** Reflects the persisted theme onto <html> so Tailwind's `dark:` variants work. */
export function useApplyTheme(): void {
  const theme = useUIStore((s) => s.theme);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
  }, [theme]);
}
