import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Footer, Masthead } from './components/layout';
import Home from './pages/Home';
import MonitorDetailPage from './pages/monitors/[slug]';
import IncidentsPage from './pages/incidents';
import AboutPage from './pages/about';
import NotFound from './pages/NotFound';

export function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col bg-ed-paper text-ed-ink">
        <Masthead />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/monitors/:slug" element={<MonitorDetailPage />} />
            <Route path="/incidents" element={<IncidentsPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
