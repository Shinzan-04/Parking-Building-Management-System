import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import './index.css';
import { ProtectedRoute } from './components/ProtectedRoute';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const GateControlPage = lazy(() => import('./pages/GateControlPage'));
const AdminLayout = lazy(() => import('./pages/Admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/Admin/Dashboard'));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="loading-screen" />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          {/* Gate Control - Chỉ Staff (role 2) */}
          <Route
            path="/gate-control"
            element={<ProtectedRoute element={<GateControlPage />} requiredRoles={['Staff', 2]} />}
          />
          {/* Admin Portal - Admin (0), Manager (1) */}
          <Route
            path="/admin"
            element={<ProtectedRoute element={<AdminLayout />} requiredRoles={['Admin', 'Manager', 0, 1]} />}
          >
            <Route index element={<AdminDashboard />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
