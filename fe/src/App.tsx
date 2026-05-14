import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import './index.css';

const LandingPage = lazy(() => import('./pages/LandingPage'));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="loading-screen" />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          {/* Thêm route mới ở đây */}
          {/* <Route path="/auth" element={<AuthPage />} /> */}
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
