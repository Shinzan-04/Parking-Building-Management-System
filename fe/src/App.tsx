import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import './index.css';

const LandingPage    = lazy(() => import('./pages/LandingPage'));
const AuthPage       = lazy(() => import('./pages/AuthPage'));
const AdminLayout    = lazy(() => import('./pages/Admin/AdminLayout'));
const AdminDashboard  = lazy(() => import('./pages/Admin/Dashboard'));
const AdminParkingLots = lazy(() => import('./pages/Admin/ParkingLots'));
const AdminVehicles    = lazy(() => import('./pages/Admin/Vehicles'));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="loading-screen" />}>
        <Routes>
          <Route path="/"     element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index                  element={<AdminDashboard />} />
            <Route path="parking-lots"    element={<AdminParkingLots />} />
            <Route path="vehicles"        element={<AdminVehicles />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
