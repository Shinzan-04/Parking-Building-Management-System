const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5237';

const TOKEN_KEY = 'sp_token';
const USER_KEY = 'sp_user';

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onRefreshed(token: string) {
  refreshSubscribers.map(cb => cb(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

export async function apiClient<T>(path: string, options?: RequestInit): Promise<T> {
  let token = localStorage.getItem(TOKEN_KEY);

  const fetchWithToken = async (currentToken: string | null) => {
    return fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
        ...(options?.headers ?? {}),
      },
    });
  };

  let res = await fetchWithToken(token);

  if (res.status === 401) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const rawUser = localStorage.getItem(USER_KEY);
        if (!rawUser) throw new Error('No user data');
        
        const user = JSON.parse(rawUser);
        if (!user.refreshToken) throw new Error('No refresh token');

        // Gọi API refresh token
        const refreshRes = await fetch(`${BASE_URL}/api/Auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: user.refreshToken })
        });

        if (!refreshRes.ok) throw new Error('Refresh token failed');

        const data = await refreshRes.json();
        
        // Cập nhật token mới vào storage
        localStorage.setItem(TOKEN_KEY, data.accessToken);
        
        const updatedUser = { ...user, accessToken: data.accessToken, refreshToken: data.refreshToken };
        localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));

        token = data.accessToken;
        onRefreshed(token as string);

        // Phát sự kiện để component (VD: useAuth) biết token vừa được refresh
        window.dispatchEvent(new CustomEvent('auth:token_refreshed', { detail: updatedUser }));

      } catch (err) {
        // Refresh thất bại (hết hạn refresh token, v.v) => Đăng xuất
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        window.dispatchEvent(new Event('auth:logout'));
        throw err;
      } finally {
        isRefreshing = false;
      }
    } else {
      // Chờ token mới nếu đang có người khác (request khác) tiến hành làm mới
      token = await new Promise<string>((resolve) => {
        addRefreshSubscriber((newToken: string) => {
          resolve(newToken);
        });
      });
    }

    // Sau khi có token mới (tự refresh hoặc chờ), gọi lại API gốc
    res = await fetchWithToken(token);
  }

  // Nếu API gốc báo 204 No Content
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  if (!text.trim()) {
    if (res.ok) return undefined as T;
    throw new Error(`Request failed (${res.status}).`);
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid response from server.');
  }

  if (!res.ok) {
    throw new Error((data as { message?: string }).message ?? `Request failed (${res.status}).`);
  }

  return data as T;
}
