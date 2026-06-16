import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { HydrationGate } from './components/HydrationGate';
import { useApplyTheme } from './hooks/useApplyTheme';
import { Overview } from './pages/Overview';
import { Requirements } from './pages/Requirements';
import { Sources } from './pages/Sources';
import { Engineering } from './pages/Engineering';
import { Modeling } from './pages/Modeling';
import { Dashboard } from './pages/Dashboard';
import { Publish } from './pages/Publish';
import { Settings } from './pages/Settings';
import { NotFound } from './pages/NotFound';

export default function App() {
  useApplyTheme();

  return (
    <HydrationGate>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Overview />} />
          <Route path="stage/requirements" element={<Requirements />} />
          <Route path="stage/sources" element={<Sources />} />
          <Route path="stage/engineering" element={<Engineering />} />
          <Route path="stage/modeling" element={<Modeling />} />
          <Route path="stage/dashboard" element={<Dashboard />} />
          <Route path="stage/publish" element={<Publish />} />
          <Route path="settings" element={<Settings />} />
          {/* Legacy/short links land on the overview. */}
          <Route path="stage" element={<Navigate to="/stage/requirements" replace />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HydrationGate>
  );
}
