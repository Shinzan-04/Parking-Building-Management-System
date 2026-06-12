// ─── Types ─────────────────────────────────────────────────────────────────

export type UserRole = 'Admin' | 'Manager' | 'Staff' | 'Driver' | 0 | 1 | 2 | 3;

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
  /** JWT Access Token — backend trả về field "accessToken" */
  accessToken: string;
  /** Refresh Token để gia hạn session */
  refreshToken: string;
  accessTokenExpiresAt: string;
  fullName: string;
  role: UserRole;
  email?: string;
  qrCode?: string;
  qrCodeImageBase64?: string;
}

export type AuthResponse = BaseAuthResponse;

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

/** Đăng ký tài khoản mới (không cần OTP) */
export async function registerApi(payload: RegisterRequest): Promise<RegisterResponse> {
  return post<RegisterRequest, RegisterResponse>('/api/auth/register', payload);
}

/** Đăng nhập / đăng ký bằng Google ID Token */
export async function googleLoginApi(idToken: string): Promise<AuthResponse> {
  return post<GoogleLoginRequest, AuthResponse>('/api/auth/google-login', { idToken });
}

// ─── OTP API ─────────────────────────────────────────────────────────────────

export interface SendOtpRequest {
  email: string;
  /** "Register" hoặc "ForgotPassword" */
  purpose: string;
}

export interface VerifyRegisterRequest {
  email: string;
  otpCode: string;
  username: string;
  password: string;
  fullName: string;
  phoneNumber?: string | null;
}

export interface ResetPasswordRequest {
  email: string;
  otpCode: string;
  newPassword: string;
}

/**
 * Gửi mã OTP về email.
 * Purpose: "Register" | "ForgotPassword"
 */
export async function sendOtpApi(payload: SendOtpRequest): Promise<{ message: string }> {
  return post<SendOtpRequest, { message: string }>('/api/auth/send-otp', payload);
}

/**
 * Xác thực OTP và hoàn tất đăng ký tài khoản.
 * Backend sẽ tạo user và trả về AuthResponse nếu thành công.
 */
export async function verifyRegisterApi(payload: VerifyRegisterRequest): Promise<RegisterResponse> {
  return post<VerifyRegisterRequest, RegisterResponse>('/api/auth/verify-register', payload);
}

/**
 * Đặt lại mật khẩu bằng OTP (quên mật khẩu).
 */
export async function resetPasswordApi(payload: ResetPasswordRequest): Promise<{ message: string }> {
  return post<ResetPasswordRequest, { message: string }>('/api/auth/reset-password', payload);
}
