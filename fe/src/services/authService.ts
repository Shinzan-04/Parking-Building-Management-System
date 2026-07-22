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
  assignedBuildingId?: string;
}

export type AuthResponse = BaseAuthResponse;

export interface RegisterResponse extends BaseAuthResponse {
  qrCode: string;
  qrCodeImageBase64: string;
}

export interface ApiError {
  message: string;
}

import { apiClient } from './apiClient';

// ─── Auth API ────────────────────────────────────────────────────────────────

/** Đăng nhập bằng username + password */
export async function loginApi(payload: LoginRequest): Promise<AuthResponse> {
  return apiClient<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) });
}

/**
 * @deprecated Chỉ dùng cho dev/testing — bỏ qua xác thực OTP.
 * Flow đăng ký thật: sendOtpApi() → verifyRegisterApi()
 */
export async function registerApi(payload: RegisterRequest): Promise<RegisterResponse> {
  return apiClient<RegisterResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) });
}

/** Đăng nhập / đăng ký bằng Google ID Token */
export async function googleLoginApi(idToken: string): Promise<AuthResponse> {
  return apiClient<AuthResponse>('/api/auth/google-login', { method: 'POST', body: JSON.stringify({ idToken }) });
}

// ─── OTP API ─────────────────────────────────────────────────────────────────

export interface SendOtpRequest {
  email: string;
  /** "Register" | "ForgotPassword" | "ChangePassword" */
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

export interface ChangePasswordRequest {
  otpCode: string;
  newPassword: string;
}

/**
 * Gửi mã OTP về email.
 * Purpose: "Register" | "ForgotPassword"
 */
export async function sendOtpApi(payload: SendOtpRequest): Promise<{ message: string }> {
  return apiClient<{ message: string }>('/api/auth/send-otp', { method: 'POST', body: JSON.stringify(payload) });
}

/**
 * Xác thực OTP và hoàn tất đăng ký tài khoản.
 * Backend sẽ tạo user và trả về AuthResponse nếu thành công.
 */
export async function verifyRegisterApi(payload: VerifyRegisterRequest): Promise<RegisterResponse> {
  return apiClient<RegisterResponse>('/api/auth/verify-register', { method: 'POST', body: JSON.stringify(payload) });
}

/**
 * Đặt lại mật khẩu bằng OTP (quên mật khẩu).
 */
export async function resetPasswordApi(payload: ResetPasswordRequest): Promise<{ message: string }> {
  return apiClient<{ message: string }>('/api/auth/reset-password', { method: 'POST', body: JSON.stringify(payload) });
}

/**
 * Đổi mật khẩu (dành cho user đã đăng nhập). Cần gửi OTP với purpose "ChangePassword" trước.
 */
export async function changePasswordApi(payload: ChangePasswordRequest): Promise<{ message: string }> {
  return apiClient<{ message: string }>('/api/auth/change-password', { method: 'POST', body: JSON.stringify(payload) });
}

export interface LogoutRequest {
  refreshToken: string;
}

/**
 * Đăng xuất khỏi hệ thống và vô hiệu hóa Refresh Token ở backend.
 */
export async function logoutApi(payload: LogoutRequest): Promise<{ message: string }> {
  return apiClient<{ message: string }>('/api/auth/logout', { method: 'POST', body: JSON.stringify(payload) });
}

export interface UpdateProfileRequest {
  fullName?: string;
  phoneNumber?: string | null;
  email?: string | null;
}

export interface ProfileResponse {
  userId: string;
  username: string;
  fullName: string;
  role: UserRole;
  email?: string;
  phoneNumber?: string;
  driverCode: string;
  qrCodeImageBase64?: string;
  createdAt: string;
}

/**
 * Lấy thông tin profile từ JWT token hiện tại
 */
export async function getProfileApi(): Promise<ProfileResponse> {
  return apiClient<ProfileResponse>('/api/auth/me', { method: 'GET' });
}

/**
 * Cập nhật thông tin profile
 */
export async function updateProfileApi(payload: UpdateProfileRequest): Promise<ProfileResponse> {
  return apiClient<ProfileResponse>('/api/auth/profile', { method: 'PUT', body: JSON.stringify(payload) });
}



