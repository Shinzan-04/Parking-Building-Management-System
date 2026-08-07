import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import './index.css';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Toaster } from 'react-hot-toast';
import { FloatingChat } from './components/FloatingChat';

const AuthPage = lazy(() => import('./pages/AuthPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));

const AdminLayout = lazy(() => import('./pages/Admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/Admin/Dashboard'));
const AdminParkingLots = lazy(() => import('./pages/Admin/ParkingLots'));
const AdminVehicles = lazy(() => import('./pages/Admin/Vehicles'));
const AdminUsers = lazy(() => import('./pages/Admin/Users'));
const AdminReports = lazy(() => import('./pages/Admin/Reports'));
const AdminRefunds = lazy(() => import('./pages/Admin/Refunds'));
const AdminPricing = lazy(() => import('./pages/Admin/Pricing'));
const AdminSessions = lazy(() => import('./pages/Admin/Sessions'));
const AdminReservations = lazy(() => import('./pages/Admin/Reservations'));
const AdminVehicleTypes = lazy(() => import('./pages/Admin/VehicleTypes'));
const AdminAuditLogs = lazy(() => import('./pages/Admin/AuditLogs'));
const AdminMonthlyPassRequests = lazy(() => import('./pages/Admin/MonthlyPassRequests'));

const ManagerLayout = lazy(() => import('./pages/Manager/ManagerLayout'));
const ManagerDashboard = lazy(() => import('./pages/Manager/Dashboard'));
const ManagerParkingLots = lazy(() => import('./pages/Manager/ParkingLots'));
const ManagerVehicleTypes = lazy(() => import('./pages/Manager/VehicleTypes'));
const ManagerPricing = lazy(() => import('./pages/Manager/Pricing'));
const ManagerSessions = lazy(() => import('./pages/Manager/Sessions'));
const ManagerReports = lazy(() => import('./pages/Manager/Reports'));
const ManagerReservations = lazy(() => import('./pages/Manager/Reservations'));
const ManagerStaff = lazy(() => import('./pages/Manager/Staff'));
const ManagerRefunds = lazy(() => import('./pages/Manager/Refunds'));
const ManagerMonthlyPassRequests = lazy(() => import('./pages/Manager/MonthlyPassRequests'));

const GateControlPage = lazy(() => import('./pages/GateControlPage'));
const StaffLayout = lazy(() => import('./pages/Staff/StaffLayout'));
const StaffDashboard = lazy(() => import('./pages/Staff/Dashboard'));
const StaffSlotList = lazy(() => import('./pages/Staff/SlotList'));
const StaffReservations = lazy(() => import('./pages/Staff/Reservations'));
const StaffExceptions = lazy(() => import('./pages/Staff/Exceptions'));
const StaffChatDashboard = lazy(() => import('./pages/Staff/ChatDashboard'));
const UserLandingPage = lazy(() => import('./pages/User/UserLandingPage'));
const FindParkingPage = lazy(() => import('./pages/User/FindParkingPage'));
const MyTicketPage = lazy(() => import('./pages/User/MyTicketPage'));
const CheckoutSuccessPage = lazy(() => import('./pages/User/CheckoutSuccessPage'));
const ProfilePage = lazy(() => import('./pages/User/ProfilePage'));
const MyVehiclePage = lazy(() => import('./pages/User/MyVehiclePage'));
const PaymentResultPage = lazy(() => import('./pages/User/PaymentResult'));
const LiveSessionPage = lazy(() => import('./pages/User/LiveSessionPage'));
const BookingPage = lazy(() => import('./pages/User/BookingPage'));
const WalletPage = lazy(() => import('./pages/User/WalletPage'));
const UserLayout = lazy(() => import('./pages/User/UserLayout'));
const MonthlyPassPage = lazy(() => import('./pages/User/MonthlyPassPage'));
export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="loading-screen" />}>
        <Routes>
          <Route element={<UserLayout />}>
            <Route path="/" element={<UserLandingPage />} />
            <Route path="/find-parking" element={<FindParkingPage />} />
            <Route path="/booking" element={<ProtectedRoute element={<BookingPage />} />} />
            <Route path="/my-tickets" element={<ProtectedRoute element={<MyTicketPage />} />} />
            <Route path="/checkout-success" element={<ProtectedRoute element={<CheckoutSuccessPage />} />} />
            <Route path="/profile" element={<ProtectedRoute element={<ProfilePage />} />} />
            <Route path="/my-vehicles" element={<ProtectedRoute element={<MyVehiclePage />} />} />
            <Route path="/live-session" element={<ProtectedRoute element={<LiveSessionPage />} />} />
            <Route path="/wallet" element={<ProtectedRoute element={<WalletPage />} />} />
            <Route path="/monthly-pass" element={<MonthlyPassPage />} />
          </Route>
          <Route path="/payment-result" element={<PaymentResultPage />} />
          <Route path="/payment-success" element={<PaymentResultPage />} />
          <Route path="/payment-cancel" element={<PaymentResultPage />} />
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
            <Route path="vehicles" element={<AdminVehicles />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="refunds" element={<AdminRefunds />} />
            <Route path="pricing" element={<AdminPricing />} />
            <Route path="sessions" element={<AdminSessions />} />
            <Route path="reservations" element={<AdminReservations />} />
            <Route path="vehicle-types" element={<AdminVehicleTypes />} />
            <Route path="monthly-pass" element={<AdminMonthlyPassRequests />} />
            <Route path="audit-logs" element={<AdminAuditLogs />} />
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
            <Route path="staff" element={<ManagerStaff />} />
            <Route path="sessions" element={<ManagerSessions />} />
            <Route path="reservations" element={<ManagerReservations />} />
            <Route path="reports" element={<ManagerReports />} />
            <Route path="refunds" element={<ManagerRefunds />} />
            <Route path="monthly-pass" element={<ManagerMonthlyPassRequests />} />
          </Route>

          {/* Staff Portal */}
          <Route
            path="/staff"
            element={<ProtectedRoute element={<StaffLayout />} requiredRoles={["Staff"]} />}
          >
            <Route index element={<Navigate to="/staff/dashboard" replace />} />
            <Route path="dashboard" element={<StaffDashboard />} />
            <Route path="slots" element={<StaffSlotList />} />
            <Route path="reservations" element={<StaffReservations />} />
            <Route path="exceptions" element={<StaffExceptions />} />
            <Route path="chat" element={<StaffChatDashboard />} />
            <Route path="gate-control/entry" element={<GateControlPage defaultTab="entry" />} />
            <Route path="gate-control/exit" element={<GateControlPage defaultTab="exit" />} />
          </Route>

        </Routes>
      </Suspense>
      <GlobalChat />
      <Toaster position="top-center" />
    </BrowserRouter>
  );
}

function GlobalChat() {
  const location = useLocation();
  // Không hiển thị bong bóng chat ở các trang quản trị / nhân viên
  const isInternalApp = ['/admin', '/manager', '/staff', '/gate-control'].some(p => location.pathname.startsWith(p));

  if (isInternalApp) return null;
  return <FloatingChat />;
}
