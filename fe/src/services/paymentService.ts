const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5237';

async function authFetch<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
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
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid response from server.');
  }

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('sp_token');
      localStorage.removeItem('sp_user');
      window.location.replace('/auth');
    }
    throw new Error((data as { message?: string }).message ?? `Yêu cầu thất bại (${res.status}).`);
  }
  return data as T;
}

export interface CreatePayOSPaymentRequest {
  amount: number;
  description: string;
  parkingSessionId?: string;
  reservationId?: string;
}

export interface PayOSCheckoutResponse {
  checkoutUrl: string;
  /** Chuỗi QR EMVCo/VietQR thật từ PayOS — dùng để render QR quét được bằng app ngân hàng */
  qrCode?: string;
  orderCode: number;
  amount: number;
  description: string;
  createdAt: string;
}

export interface PaymentStatusResult {
  sessionId: string;
  paymentStatus: string;
  paymentMethod: string;
  amount?: number;
  paymentDate?: string;
  payOSOrderCode: number;
  statusLabel: string;
}

export const createPayOSPayment = (payload: CreatePayOSPaymentRequest, token: string): Promise<PayOSCheckoutResponse> =>
  authFetch('/api/payments/payos/create', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const getPaymentStatus = (sessionId: string, token: string): Promise<PaymentStatusResult> =>
  authFetch(`/api/payments/status/${sessionId}`, token);

export interface VerifyPaymentResult {
  orderCode: number;
  status: string;
  isPaid: boolean;
}

export const verifyPayment = (orderCode: number, token: string): Promise<VerifyPaymentResult> =>
  authFetch(`/api/payments/verify/${orderCode}`, token);

// ─── Refund Management (Admin / Manager / Staff) ────────────────────────────

export type PaymentStatus =
  | 'Pending'
  | 'Success'
  | 'Failed'
  | 'Refunding'
  | 'Refunded'
  | 'RefundFailed';

export interface PaymentListItem {
  paymentId: string;
  payOSOrderCode: number;
  amount: number;
  description: string | null;
  status: PaymentStatus;
  paymentMethod: string;
  paymentDate: string;
  reservationId: string | null;
  parkingSessionId: string | null;
  userId: string | null;
  userFullName: string | null;
  userEmail: string | null;
  refundedAt: string | null;
  refundReferenceId: string | null;
  refundProvider: string | null;
  refundTransactionId: string | null;
  refundFailureReason: string | null;
  transactionType: string | null;
}

export interface PaymentListResult {
  items: PaymentListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export const getPaymentList = (
  token: string,
  params: { status?: string; page?: number; pageSize?: number } = {}
): Promise<PaymentListResult> => {
  const qs = new URLSearchParams();
  if (params.status)   qs.set('status',   params.status);
  if (params.page)     qs.set('page',     String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  const query = qs.toString() ? `?${qs}` : '';
  return authFetch(`/api/payments/list${query}`, token);
};

export interface PaymentRefundResponse {
  paymentId: string;
  reservationId: string | null;
  amount: number;
  status: PaymentStatus;
  provider: string | null;
  referenceId: string | null;
  transactionId: string | null;
  refundedAt: string | null;
  message: string | null;
}

export const refundPayment = (
  paymentId: string,
  token: string
): Promise<PaymentRefundResponse> =>
  authFetch(`/api/payments/${paymentId}/refund`, token, { method: 'POST' });

export const rejectRefund = (
  paymentId: string,
  reason: string,
  token: string
): Promise<{ message: string }> =>
  authFetch(`/api/payments/${paymentId}/reject-refund`, token, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });

// ─── Transaction History & Revenue ───────────────────────────────────────────

export interface TransactionHistoryResult {
  items: PaymentListItem[];
  totalAmount: number;
  parkingRevenue: number;
  bookingRevenue: number;
  subscriptionRevenue: number;
  topUpRevenue: number;
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const getTransactions = (
  token: string,
  params: {
    fromDate?: string;
    toDate?: string;
    paymentMethod?: string;
    page?: number;
    pageSize?: number;
  } = {}
): Promise<TransactionHistoryResult> => {
  const qs = new URLSearchParams();
  if (params.fromDate) qs.set('fromDate', params.fromDate);
  if (params.toDate) qs.set('toDate', params.toDate);
  if (params.paymentMethod) qs.set('paymentMethod', params.paymentMethod);
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  
  const query = qs.toString() ? `?${qs}` : '';
  return authFetch(`/api/Transactions${query}`, token);
};

