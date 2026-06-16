import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

/** Persistent application chrome: sidebar + topbar wrapping the routed page. */
export function AppShell() {
  return (
    <div className="flex h-full w-full overflow-hidden bg-canvas">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl animate-fade-in px-6 py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
