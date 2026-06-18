import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useBannerStore } from '../store/bannerStore';
import { cn } from '../lib/cn';
import { CheckIcon } from '../icons';

/**
 * Renders the global notification banners (spec 1.8, 1.9). Banners are persistent
 * — they never auto-dismiss on a timer. Navigating to another tab counts as the
 * user "taking another action", so we clear banners on route change; a banner can
 * also be dismissed explicitly.
 */
export function BannerHost() {
  const banners = useBannerStore((s) => s.banners);
  const dismiss = useBannerStore((s) => s.dismiss);
  const clear = useBannerStore((s) => s.clear);
  const location = useLocation();
  const firstRender = useRef(true);

  useEffect(() => {
    // Clear on navigation, but not on the very first mount (so a banner raised
    // during load survives the initial render).
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    clear();
  }, [location.pathname, clear]);

  if (banners.length === 0) return null;

  return (
    <div className="space-y-2 px-6 pt-4">
      {banners.map((b) => (
        <div
          key={b.id}
          role={b.kind === 'error' ? 'alert' : 'status'}
          className={cn(
            'flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-card',
            b.kind === 'error'
              ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200'
              : 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200',
          )}
        >
          <span className="mt-0.5 shrink-0">
            {b.kind === 'error' ? (
              <span aria-hidden className="font-bold">
                !
              </span>
            ) : (
              <CheckIcon width={16} height={16} strokeWidth={2.5} />
            )}
          </span>
          <p className="flex-1">{b.message}</p>
          <button
            onClick={() => dismiss(b.id)}
            aria-label="Dismiss"
            className="shrink-0 rounded px-1 text-current/70 hover:text-current"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
