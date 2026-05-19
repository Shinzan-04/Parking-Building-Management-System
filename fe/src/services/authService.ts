// ─── Types ─────────────────────────────────────────────────────────────────

export type UserRole = 'Admin' | 'Manager' | 'Driver';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  fullName: string;
  phoneNumber?: string | null;
  email?: string | null;
}

export interface GoogleLoginRequest {
  idToken: string;
}

export interface BaseAuthResponse {
  userId: string;
  token: string;
  fullName: string;
  role: UserRole;
}

export interface AuthResponse extends BaseAuthResponse {}

export interface RegisterResponse extends BaseAuthResponse {
  qrCode: string;
  qrCodeImageBase64: string;
}

export interface ApiError {
  message: string;
}

// ─── Config ─────────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5237';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function post<TBody, TResponse>(path: string, body: TBody): Promise<TResponse> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    // BE trả về { message: "..." } khi lỗi
    throw new Error((data as ApiError).message ?? 'Đã xảy ra lỗi, vui lòng thử lại.');
  }

  return data as TResponse;
}

// ─── Auth API ────────────────────────────────────────────────────────────────

/** Đăng nhập bằng username + password */
export async function loginApi(payload: LoginRequest): Promise<AuthResponse> {
  return post<LoginRequest, AuthResponse>('/api/auth/login', payload);
}

/** Đăng ký tài khoản mới */
export async function registerApi(payload: RegisterRequest): Promise<RegisterResponse> {
  return post<RegisterRequest, RegisterResponse>('/api/auth/register', payload);
}

/** Đăng nhập / đăng ký bằng Google ID Token */
export async function googleLoginApi(idToken: string): Promise<AuthResponse> {
  return post<GoogleLoginRequest, AuthResponse>('/api/auth/google-login', { idToken });
}
