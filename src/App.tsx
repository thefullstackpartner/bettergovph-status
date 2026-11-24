import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Footer, Masthead } from './components/layout';
import Home from './pages/Home';
import MonitorDetailPage from './pages/monitors/[slug]';
import IncidentsPage from './pages/incidents';
import AboutPage from './pages/about';
import NotFound from './pages/NotFound';

const DashboardPage = lazy(() => import('./pages/dashboard'));

export function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col bg-ed-paper text-ed-ink">
        <Masthead />
        <main className="flex-1">
          <Suspense
            fallback={
              <div className="mx-auto max-w-page px-4 py-8 font-sans-ed text-sm text-ed-ink-3">
                Loading page...
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/dashboard" element={<Navigate to="/" replace />} />
              <Route path="/status" element={<Home />} />
              <Route path="/monitors/:slug" element={<MonitorDetailPage />} />
              <Route path="/incidents" element={<IncidentsPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
