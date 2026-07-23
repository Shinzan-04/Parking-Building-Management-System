import { apiClient } from './apiClient';

/**
 * subscriptionService.ts
 * Giao tiếp với API Subscriptions & MonthlyPassPolicies
 */


// ── Enums ─────────────────────────────────────────────────────────────────────
// Tương ứng với SubscriptionStatus bên backend
export type SubscriptionStatus =
  | 'PendingPayment'
  | 'Active'
  | 'Expired'
  | 'Canceled'
  | 'PendingCancel';

// Tương ứng với PaymentMethod enum bên backend (chỉ dùng giá trị số nguyên)
export type PaymentMethodValue = 0 | 1 | 2 | 3 | 4 | 5;
// 0=Cash, 1=Momo, 2=VNPay, 3=CreditCard, 4=PayOS, 5=Wallet

// ── DTOs ──────────────────────────────────────────────────────────────────────
export interface MonthlyPassPolicyResponse {
  id: string;
  vehicleTypeId: string;
  vehicleTypeName: string;
  monthlyPrice: number;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateMonthlyPassPolicyRequest {
  vehicleTypeId: string;
  monthlyPrice: number;
}

export interface UpdateMonthlyPassPolicyRequest {
  monthlyPrice: number;
  description?: string | null;
  isActive?: boolean;
}

export interface SubscriptionResponse {
  id: string;
  driverId: string;
  driverName: string;
  vehicleTypeId: string;
  vehicleTypeName: string;
  licensePlate: string;
  startDate: string;
  endDate: string;
  status: SubscriptionStatus;
  statusText: string;
  paymentId: string | null;
  createdAt: string;
  cancelReason: string | null;
  cancelRejectReason: string | null;
  canCancel: boolean;
  cancelValidationMessage: string | null;
}

export interface RegisterSubscriptionRequest {
  vehicleId: string;
  paymentMethod: PaymentMethodValue;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// ── MonthlyPassPolicies API ───────────────────────────────────────────────────
export const getAllPolicies = (): Promise<MonthlyPassPolicyResponse[]> =>
  apiClient('/api/MonthlyPassPolicies');

export const getPolicyByVehicleType = (vehicleTypeId: string): Promise<MonthlyPassPolicyResponse> =>
  apiClient(`/api/MonthlyPassPolicies/vehicle-type/${vehicleTypeId}`);

export const createMonthlyPassPolicy = (payload: CreateMonthlyPassPolicyRequest): Promise<MonthlyPassPolicyResponse> =>
  apiClient('/api/MonthlyPassPolicies', { method: 'POST', body: JSON.stringify(payload) });

export const updateMonthlyPassPolicy = (id: string, payload: UpdateMonthlyPassPolicyRequest): Promise<MonthlyPassPolicyResponse> =>
  apiClient(`/api/MonthlyPassPolicies/${id}`, { method: 'PUT', body: JSON.stringify(payload) });

export const deleteMonthlyPassPolicy = (id: string): Promise<void> =>
  apiClient(`/api/MonthlyPassPolicies/${id}`, { method: 'DELETE' });

// ── Subscriptions API ─────────────────────────────────────────────────────────
export const getMySubscriptions = (): Promise<SubscriptionResponse[]> =>
  apiClient('/api/Subscriptions/my-subscriptions');

// Kết quả đăng ký — Wallet trả về subscription, PayOS trả thêm checkoutUrl + qrCode
export interface RegisterSubscriptionResult {
  message: string;
  subscriptionId: string;
  checkoutUrl?: string; // chỉ có khi paymentMethod = PayOS (4)
  qrCode?: string;      // chuỗi EMVCo VietQR thật để render QR quét được
  orderCode?: number;   // dùng để verify trạng thái thanh toán trực tiếp qua PayOS API
}

export const registerSubscription = (
  payload: RegisterSubscriptionRequest,
  token: string,
): Promise<RegisterSubscriptionResult> =>
  apiClient('/api/Subscriptions/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const requestCancelSubscription = (
  id: string,
  reason: string,
  token: string,
): Promise<{ message: string }> =>
  apiClient(`/api/Subscriptions/${id}/request-cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });

// Verify + kích hoạt vé tháng đang PendingPayment nếu đã thanh toán PayOS thành công.
// Dùng cho polling trong modal đăng ký, và để kiểm tra lại thủ công nếu user đã đóng modal
// trước khi thanh toán được xác nhận (subscription bị auto-cancel sau 15 phút nếu không kích hoạt).
export const verifySubscriptionPayment = (
  id: string,
  token: string,
): Promise<{ isActive: boolean }> =>
  apiClient(`/api/Subscriptions/${id}/verify-payment`, { method: 'POST' });

// ── Admin/Manager API ────────────────────────────────────────────────────────
export const getAllSubscriptions = (): Promise<SubscriptionResponse[]> =>
  apiClient('/api/Subscriptions');

export const processCancelSubscription = (
  id: string,
  payload: { isApproved: boolean; refundAmount: number; rejectReason?: string },
  token: string,
): Promise<{ message: string }> =>
  apiClient(`/api/Subscriptions/${id}/process-cancel`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

// ── Payments API ──────────────────────────────────────────────────────────────
// Verify trạng thái thanh toán PayOS trực tiếp từ PayOS API (không phụ thuộc webhook).
// Backend sẽ tự kích hoạt Subscription nếu thanh toán đã thành công.
export interface VerifyPayOSPaymentResult {
  orderCode: number;
  status: string;
  isPaid: boolean;
}

export const verifyPayOSPayment = (
  orderCode: number,
  token: string,
): Promise<VerifyPayOSPaymentResult> =>
  apiClient(`/api/payments/verify/${orderCode}`);
