/**
 * subscriptionService.ts
 * Giao tiếp với API Subscriptions & MonthlyPassPolicies
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5237';

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
async function apiFetch<T>(path: string, token?: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  if (!text.trim()) {
    if (res.ok) return undefined as T;
    throw new Error(`Yêu cầu thất bại (${res.status}).`);
  }

  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error('Phản hồi không hợp lệ.'); }

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('sp_token');
      localStorage.removeItem('sp_user');
      window.location.replace('/auth');
    }
    throw new Error((data as { message?: string }).message ?? `Lỗi ${res.status}.`);
  }
  return data as T;
}

// ── MonthlyPassPolicies API ───────────────────────────────────────────────────
export const getAllPolicies = (): Promise<MonthlyPassPolicyResponse[]> =>
  apiFetch('/api/MonthlyPassPolicies');

export const getPolicyByVehicleType = (vehicleTypeId: string): Promise<MonthlyPassPolicyResponse> =>
  apiFetch(`/api/MonthlyPassPolicies/vehicle-type/${vehicleTypeId}`);

export const createMonthlyPassPolicy = (payload: CreateMonthlyPassPolicyRequest, token: string): Promise<MonthlyPassPolicyResponse> =>
  apiFetch('/api/MonthlyPassPolicies', token, { method: 'POST', body: JSON.stringify(payload) });

export const updateMonthlyPassPolicy = (id: string, payload: UpdateMonthlyPassPolicyRequest, token: string): Promise<MonthlyPassPolicyResponse> =>
  apiFetch(`/api/MonthlyPassPolicies/${id}`, token, { method: 'PUT', body: JSON.stringify(payload) });

export const deleteMonthlyPassPolicy = (id: string, token: string): Promise<void> =>
  apiFetch(`/api/MonthlyPassPolicies/${id}`, token, { method: 'DELETE' });

// ── Subscriptions API ─────────────────────────────────────────────────────────
export const getMySubscriptions = (token: string): Promise<SubscriptionResponse[]> =>
  apiFetch('/api/Subscriptions/my-subscriptions', token);

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
  apiFetch('/api/Subscriptions/register', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const requestCancelSubscription = (
  id: string,
  reason: string,
  token: string,
): Promise<{ message: string }> =>
  apiFetch(`/api/Subscriptions/${id}/request-cancel`, token, {
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
  apiFetch(`/api/Subscriptions/${id}/verify-payment`, token, { method: 'POST' });

// ── Admin/Manager API ────────────────────────────────────────────────────────
export const getAllSubscriptions = (token: string): Promise<SubscriptionResponse[]> =>
  apiFetch('/api/Subscriptions', token);

export const processCancelSubscription = (
  id: string,
  payload: { isApproved: boolean; refundAmount: number; rejectReason?: string },
  token: string,
): Promise<{ message: string }> =>
  apiFetch(`/api/Subscriptions/${id}/process-cancel`, token, {
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
  apiFetch(`/api/payments/verify/${orderCode}`, token);
