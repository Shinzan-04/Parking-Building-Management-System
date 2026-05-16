import { useState, useCallback } from 'react';
import {
  loginApi,
  registerApi,
  googleLoginApi,
  type AuthResponse,
  type BaseAuthResponse,
  type LoginRequest,
  type RegisterRequest,
  type RegisterResponse,
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
  const [user, setUser] = useState<AuthResponse | null>(readStorage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveSession = useCallback((response: BaseAuthResponse) => {
    localStorage.setItem(TOKEN_KEY, response.token);
    localStorage.setItem(USER_KEY, JSON.stringify(response));
    setUser(response);
    setError(null);
  }, []);

  /** Đăng nhập bằng username + password */
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

  /** Đăng ký bằng username + password + thông tin hồ sơ */
  const register = useCallback(async (payload: RegisterRequest) => {
    setLoading(true);
    setError(null);
    try {
      const response: RegisterResponse = await registerApi(payload);
      saveSession(response);
      return response;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Đăng ký thất bại.';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [saveSession]);

  /** Đăng nhập bằng Google ID Token */
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

  /** Đăng xuất */
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setError(null);
  }, []);

  return {
    user,
    token: user?.token ?? null,
    isAuthenticated: !!user,
    loading,
    error,
    login,
    register,
    loginWithGoogle,
    logout,
  };
}
