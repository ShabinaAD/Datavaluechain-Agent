import { Outlet } from 'react-router-dom';
import { Topbar } from './Topbar';
import { TopTabs } from './TopTabs';
import { BannerHost } from './BannerHost';

/**
 * Persistent application chrome: topbar + the six workflow tabs, wrapping the
 * routed page. Global banners render above the page content so errors/successes
 * are always visible (spec 1.8, 1.9).
 */
export function AppShell() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-canvas">
      <Topbar />
      <TopTabs />
      <main className="flex-1 overflow-y-auto">
        <BannerHost />
        <div className="mx-auto max-w-5xl animate-fade-in px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
