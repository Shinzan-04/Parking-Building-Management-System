import { useState, useCallback } from 'react';
import {
  loginApi,
  googleLoginApi,
  type AuthResponse,
  type BaseAuthResponse,
  type LoginRequest,
} from '../services/authService';

const TOKEN_KEY = 'sp_token';
const USER_KEY  = 'sp_user';

function readStorage(): AuthResponse | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthResponse) : null;
  } catch {
    return null;
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAuth() {
  const [user, setUser]       = useState<AuthResponse | null>(readStorage);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  /**
   * Lưu session vào localStorage và cập nhật React state.
   * Dùng sau khi verify-register hoặc bất kỳ API nào trả về AuthResponse.
   */
  const saveSession = useCallback((response: BaseAuthResponse) => {
    localStorage.setItem(TOKEN_KEY, response.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(response));
    setUser(response);
    setError(null);
  }, []);

  /**
   * Đăng nhập bằng username + password.
   * Gọi POST /api/auth/login
   */
  const login = useCallback(async (payload: LoginRequest) => {
    setLoading(true);
    setError(null);
    try {
      const response = await loginApi(payload);
      saveSession(response);
      return response;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Đăng nhập thất bại.';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [saveSession]);

  /**
   * Đăng nhập bằng Google ID Token.
   * Gọi POST /api/auth/google-login
   */
  const loginWithGoogle = useCallback(async (idToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await googleLoginApi(idToken);
      saveSession(response);
      return response;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google đăng nhập thất bại.';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [saveSession]);

  /** Đăng xuất — xoá token khỏi localStorage và reset state */
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setError(null);
  }, []);

  return {
    user,
    /** JWT access token hiện tại (null nếu chưa đăng nhập) */
    token:           user?.accessToken ?? null,
    isAuthenticated: !!user,
    loading,
    error,
    login,
    loginWithGoogle,
    logout,
    /** Lưu session thủ công — dùng sau verify-register OTP */
    saveSession,
  };
}
