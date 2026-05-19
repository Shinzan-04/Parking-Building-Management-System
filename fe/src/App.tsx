import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import './index.css';
import { ProtectedRoute } from './components/ProtectedRoute';

const LandingPage    = lazy(() => import('./pages/LandingPage'));
const AuthPage       = lazy(() => import('./pages/AuthPage'));
const AdminLayout    = lazy(() => import('./pages/Admin/AdminLayout'));
const AdminDashboard  = lazy(() => import('./pages/Admin/Dashboard'));
const AdminParkingLots = lazy(() => import('./pages/Admin/ParkingLots'));
const AdminVehicles    = lazy(() => import('./pages/Admin/Vehicles'));
const AdminUsers       = lazy(() => import('./pages/Admin/Users'));
const GateControlPage = lazy(() => import('./pages/GateControlPage'));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="loading-screen" />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />

          {/* Gate Control - Chỉ Staff */}
          <Route
            path="/gate-control"
            element={<ProtectedRoute element={<GateControlPage />} requiredRoles={["Staff"]} />}
          />

          {/* Admin Portal - chỉ cho Admin và Manager */}
          <Route
            path="/admin"
            element={<ProtectedRoute element={<AdminLayout />} requiredRoles={["Admin", "Manager"]} />}
          >
            <Route index element={<AdminDashboard />} />
            <Route path="parking-lots" element={<AdminParkingLots />} />
            <Route path="vehicles" element={<AdminVehicles />} />
            <Route path="users" element={<AdminUsers />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
