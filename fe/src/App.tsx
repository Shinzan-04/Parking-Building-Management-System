import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import './index.css';
import { ProtectedRoute } from './components/ProtectedRoute';

const AuthPage         = lazy(() => import('./pages/AuthPage'));

const AdminLayout      = lazy(() => import('./pages/Admin/AdminLayout'));
const AdminDashboard   = lazy(() => import('./pages/Admin/Dashboard'));
const AdminParkingLots = lazy(() => import('./pages/Admin/ParkingLots'));
const AdminVehicles    = lazy(() => import('./pages/Admin/Vehicles'));
const AdminUsers       = lazy(() => import('./pages/Admin/Users'));

const ManagerLayout        = lazy(() => import('./pages/Manager/ManagerLayout'));
const ManagerDashboard     = lazy(() => import('./pages/Manager/Dashboard'));
const ManagerParkingLots   = lazy(() => import('./pages/Manager/ParkingLots'));
const ManagerVehicleTypes  = lazy(() => import('./pages/Manager/VehicleTypes'));
const ManagerPricing       = lazy(() => import('./pages/Manager/Pricing'));

const GateControlPage  = lazy(() => import('./pages/GateControlPage'));
const UserLandingPage  = lazy(() => import('./pages/User/UserLandingPage'));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="loading-screen" />}>
        <Routes>
          <Route path="/" element={<UserLandingPage />} />
          <Route path="/auth" element={<AuthPage />} />

          {/* Admin Portal - chỉ Admin */}
          <Route
            path="/admin"
            element={<ProtectedRoute element={<AdminLayout />} requiredRoles={["Admin"]} />}
          >
            <Route index element={<AdminDashboard />} />
            <Route path="parking-lots" element={<AdminParkingLots />} />
            <Route path="vehicles" element={<AdminVehicles />} />
            <Route path="users" element={<AdminUsers />} />
          </Route>

          {/* Manager Portal - chỉ Manager */}
          <Route
            path="/manager"
            element={<ProtectedRoute element={<ManagerLayout />} requiredRoles={["Manager"]} />}
          >
            <Route index element={<ManagerDashboard />} />
            <Route path="parking-lots" element={<ManagerParkingLots />} />
            <Route path="vehicles" element={<ManagerVehicleTypes />} />
            <Route path="pricing" element={<ManagerPricing />} />
          </Route>

          {/* Gate Control - chỉ Staff */}
          <Route
            path="/gate-control"
            element={<ProtectedRoute element={<GateControlPage />} requiredRoles={["Staff"]} />}
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
