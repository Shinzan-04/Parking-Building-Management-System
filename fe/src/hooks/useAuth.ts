import { useState, useCallback, useEffect } from 'react';
import {
  loginApi,
  googleLoginApi,
  logoutApi,
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

  // Lắng nghe sự kiện từ apiClient
  useEffect(() => {
    const handleLogout = () => {
      setUser(null);
      setError('Your session has expired. Please log in again.');
    };

    const handleTokenRefreshed = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setUser(customEvent.detail);
      }
    };

    window.addEventListener('auth:logout', handleLogout);
    window.addEventListener('auth:token_refreshed', handleTokenRefreshed);

    return () => {
      window.removeEventListener('auth:logout', handleLogout);
      window.removeEventListener('auth:token_refreshed', handleTokenRefreshed);
    };
  }, []);

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
   * - Bật trạng thái loading để UI vô hiệu hóa nút Submit
   * - Gọi API POST /api/auth/login
   * - Lưu session và trả kết quả nếu thành công
   * - Lưu lỗi vào state `error` nếu thất bại
   */
  const login = useCallback(async (payload: LoginRequest) => {
    setLoading(true); // Bật trạng thái loading
    setError(null);   // Xóa lỗi cũ
    try {
      // Gọi API gửi request xuống backend
      const response = await loginApi(payload);
      
      // Đăng nhập thành công, lưu Access Token và dữ liệu User vào LocalStorage
      saveSession(response); 
      return response;
    } catch (err) {
      // Xử lý lỗi và hiển thị lên giao diện qua biến state `error`
      const msg = err instanceof Error ? err.message : 'Login failed.';
      setError(msg);
      throw err;
    } finally {
      setLoading(false); // Tắt trạng thái loading
    }
  }, [saveSession]);

  /**
   * Đăng nhập bằng Google ID Token.
   * - Nhận idToken từ giao diện (sau khi user xác nhận trên popup Google)
   * - Gọi POST /api/auth/google-login để Backend kiểm chứng token
   * - Nếu hợp lệ, lưu session tương tự như login thường
   */
  const loginWithGoogle = useCallback(async (idToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await googleLoginApi(idToken);
      saveSession(response); // Lưu token hệ thống trả về
      return response;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google login failed.';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [saveSession]);

  /** Đăng xuất — xoá token khỏi localStorage, reset state và gọi API vô hiệu hoá refresh token trên Backend dưới nền */
  const logout = useCallback(() => {
    const refreshToken = user?.refreshToken;

    // Xóa session ở client ngay lập tức để tránh độ trễ giao diện
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setError(null);

    // Gọi API logout lên backend chạy ngầm
    if (refreshToken) {
      logoutApi({ refreshToken }).catch((err) => {
        console.error('Lỗi khi gọi API logout lên Backend:', err);
      });
    }
  }, [user]);

  const updateUser = useCallback((updatedFields: Partial<AuthResponse>) => {
    if (user) {
      const updated = { ...user, ...updatedFields };
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      setUser(updated);
    }
  }, [user]);

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
    /** Cập nhật thông tin user hiện tại */
    updateUser,
  };
}
