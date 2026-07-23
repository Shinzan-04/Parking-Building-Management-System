import { apiClient } from './apiClient';



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

export const createPayOSPayment = (payload: CreatePayOSPaymentRequest): Promise<PayOSCheckoutResponse> =>
  apiClient('/api/payments/payos/create', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const getPaymentStatus = (sessionId: string): Promise<PaymentStatusResult> =>
  apiClient(`/api/payments/status/${sessionId}`);

export interface VerifyPaymentResult {
  orderCode: number;
  status: string;
  isPaid: boolean;
}

export const verifyPayment = (orderCode: number): Promise<VerifyPaymentResult> =>
  apiClient(`/api/payments/verify/${orderCode}`);

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
  return apiClient(`/api/payments/list${query}`);
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
  apiClient(`/api/payments/${paymentId}/refund`, { method: 'POST' });

export const rejectRefund = (
  paymentId: string,
  reason: string,
  token: string
): Promise<{ message: string }> =>
  apiClient(`/api/payments/${paymentId}/reject-refund`, {
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
  return apiClient(`/api/Transactions${query}`);
};

