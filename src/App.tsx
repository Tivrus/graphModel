import { useEffect } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import TitleBar from './components/TitleBar';
import TopBar from './components/TopBar';
import { APP_ROUTES, UTILITY_PATHS } from './app/tabs';
import { isDesktopApp } from './app/desktop';
import { useGraphStore } from './store/graphStore';

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const view = useGraphStore((s) => s.view);
  const activeSlot = useGraphStore((s) => s.activeSlot);
  const desktop = isDesktopApp();

  const keepAlive = APP_ROUTES.find((r) => r.keepAlive);
  const onKeepAlive = keepAlive ? location.pathname === keepAlive.path : false;
  const KeepAlivePage = keepAlive?.element;

  useEffect(() => {
    if (UTILITY_PATHS.has(location.pathname)) return;
    const want = view === '2d' ? '/flat' : '/';
    if (location.pathname !== want) navigate(want, { replace: true });
  }, [view, activeSlot, location.pathname, navigate]);

  useEffect(() => {
    void useGraphStore.getState().refreshBackendStatus();
    const id = window.setInterval(() => {
      void useGraphStore.getState().refreshBackendStatus();
    }, 8000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className={`app ${desktop ? 'app-desktop' : ''}`}>
      <TitleBar />
      <TopBar />
      <main className="main">
        {KeepAlivePage && (
          <div
            className="keepalive"
            style={{
              visibility: onKeepAlive ? 'visible' : 'hidden',
              pointerEvents: onKeepAlive ? 'auto' : 'none',
            }}
          >
            <KeepAlivePage />
          </div>
        )}
        <Routes>
          {APP_ROUTES.filter((r) => !r.keepAlive).map((r) => (
            <Route key={r.id} path={r.path} element={<r.element />} />
          ))}
          <Route path="*" element={null} />
        </Routes>
      </main>
    </div>
  );
}
