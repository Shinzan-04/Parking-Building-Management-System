import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import './index.css';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const AuthPage     = lazy(() => import('./pages/AuthPage'));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="loading-screen" />}>
        <Routes>
          <Route path="/"     element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
