import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import './index.css';
import { ProtectedRoute } from './components/ProtectedRoute';

const AuthPage            = lazy(() => import('./pages/AuthPage'));
const VerifyEmailPage     = lazy(() => import('./pages/VerifyEmailPage'));
const ForgotPasswordPage  = lazy(() => import('./pages/ForgotPasswordPage'));

const AdminLayout      = lazy(() => import('./pages/Admin/AdminLayout'));
const AdminDashboard   = lazy(() => import('./pages/Admin/Dashboard'));
const AdminParkingLots = lazy(() => import('./pages/Admin/ParkingLots'));
const AdminVehicles    = lazy(() => import('./pages/Admin/Vehicles'));
const AdminUsers       = lazy(() => import('./pages/Admin/Users'));
const AdminReports     = lazy(() => import('./pages/Admin/Reports'));
const AdminSettings    = lazy(() => import('./pages/Admin/Settings'));

const ManagerLayout       = lazy(() => import('./pages/Manager/ManagerLayout'));
const ManagerDashboard    = lazy(() => import('./pages/Manager/Dashboard'));
const ManagerParkingLots  = lazy(() => import('./pages/Manager/ParkingLots'));
const ManagerVehicleTypes = lazy(() => import('./pages/Manager/VehicleTypes'));
const ManagerPricing      = lazy(() => import('./pages/Manager/Pricing'));
const ManagerSessions     = lazy(() => import('./pages/Manager/Sessions'));
const ManagerReports      = lazy(() => import('./pages/Manager/Reports'));
const ManagerReservations = lazy(() => import('./pages/Manager/Reservations'));
const ManagerStaff        = lazy(() => import('./pages/Manager/Staff'));

const GateControlPage  = lazy(() => import('./pages/GateControlPage'));
const StaffLayout      = lazy(() => import('./pages/Staff/StaffLayout'));
const StaffDashboard   = lazy(() => import('./pages/Staff/Dashboard'));
const StaffSlotList    = lazy(() => import('./pages/Staff/SlotList'));
const UserLandingPage  = lazy(() => import('./pages/User/UserLandingPage'));
const BookingPage      = lazy(() => import('./pages/User/BookingPage'));
const MyTicketPage     = lazy(() => import('./pages/User/MyTicketPage'));
const ProfilePage      = lazy(() => import('./pages/User/ProfilePage'));
const MyVehiclePage    = lazy(() => import('./pages/User/MyVehiclePage'));
const PaymentResultPage= lazy(() => import('./pages/User/PaymentResult'));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="loading-screen" />}>
        <Routes>
          <Route path="/" element={<UserLandingPage />} />
          <Route path="/booking" element={<BookingPage />} />
          <Route path="/myticket" element={<ProtectedRoute element={<MyTicketPage />} />} />
          <Route path="/profile" element={<ProtectedRoute element={<ProfilePage />} />} />
          <Route path="/my-vehicles" element={<ProtectedRoute element={<MyVehiclePage />} />} />
          <Route path="/payment-result" element={<PaymentResultPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* Admin Portal - chỉ Admin */}
          <Route
            path="/admin"
            element={<ProtectedRoute element={<AdminLayout />} requiredRoles={["Admin"]} />}
          >
            <Route index element={<AdminDashboard />} />
            <Route path="parking-lots" element={<AdminParkingLots />} />
            <Route path="vehicles"     element={<AdminVehicles />} />
            <Route path="users"        element={<AdminUsers />} />
            <Route path="reports"      element={<AdminReports />} />
            <Route path="settings"     element={<AdminSettings />} />
          </Route>

          {/* Manager Portal - chỉ Manager */}
          <Route
            path="/manager"
            element={<ProtectedRoute element={<ManagerLayout />} requiredRoles={["Manager"]} />}
          >
            <Route index element={<ManagerDashboard />} />
            <Route path="parking-lots" element={<ManagerParkingLots />} />
            <Route path="vehicles"     element={<ManagerVehicleTypes />} />
            <Route path="pricing"      element={<ManagerPricing />} />
            <Route path="staff"         element={<ManagerStaff />} />
            <Route path="sessions"      element={<ManagerSessions />} />
            <Route path="reservations"  element={<ManagerReservations />} />
            <Route path="reports"       element={<ManagerReports />} />
          </Route>

          {/* Staff Portal */}
          <Route
            path="/staff"
            element={<ProtectedRoute element={<StaffLayout />} requiredRoles={["Staff"]} />}
          >
            <Route index element={<StaffDashboard />} />
            <Route path="slots" element={<StaffSlotList />} />
          </Route>

          {/* Gate Control - Staff standalone */}
          <Route
            path="/gate-control"
            element={<ProtectedRoute element={<GateControlPage />} requiredRoles={["Staff"]} />}
          />

        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
