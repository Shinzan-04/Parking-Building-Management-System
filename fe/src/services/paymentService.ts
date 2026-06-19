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
    throw new Error('Phản hồi từ máy chủ không hợp lệ.');
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

