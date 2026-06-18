import { create } from 'zustand';

/**
 * Global, persistent notification banners (spec 1.8, 1.9).
 *
 * Banners are intentionally NOT persisted and NOT auto-dismissed on a timer — a
 * vanishing error is worse than a visible one. A banner stays until the user
 * takes another action (navigates, runs something new, or dismisses it).
 */
export type BannerKind = 'error' | 'success';

export interface Banner {
  id: string;
  kind: BannerKind;
  message: string;
}

interface BannerState {
  banners: Banner[];
  notify: (kind: BannerKind, message: string) => void;
  error: (message: string) => void;
  success: (message: string) => void;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const useBannerStore = create<BannerState>((set) => ({
  banners: [],
  notify: (kind, message) =>
    set((s) => ({
      banners: [
        ...s.banners,
        { id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, kind, message },
      ],
    })),
  error: (message) =>
    set((s) => ({
      banners: [
        ...s.banners,
        { id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, kind: 'error', message },
      ],
    })),
  success: (message) =>
    set((s) => ({
      banners: [
        ...s.banners,
        { id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, kind: 'success', message },
      ],
    })),
  dismiss: (id) => set((s) => ({ banners: s.banners.filter((b) => b.id !== id) })),
  clear: () => set({ banners: [] }),
}));
