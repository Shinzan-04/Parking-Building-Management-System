const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5237';

// Role enum: Admin=0, Manager=1, Staff=2, Driver=3
export type ApiRole = 'Admin' | 'Manager' | 'Staff' | 'Driver';

const ROLE_NUM_MAP: Record<number, ApiRole> = {
  0: 'Admin', 1: 'Manager', 2: 'Staff', 3: 'Driver',
};

export function normalizeRole(role: ApiRole | number): ApiRole {
  if (typeof role === 'number') return ROLE_NUM_MAP[role] ?? 'Driver';
  return role;
}

export interface UserResponse {
  id: string;
  username: string;
  fullName: string;
  role: ApiRole | number;
  phoneNumber?: string | null;
  email?: string | null;
  qrCode: string;
  createdAt: string;
  assignedBuildingId?: string | null;
  failedLoginCount?: number;
  lockoutEnd?: string | null;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  fullName: string;
  role: ApiRole;
  phoneNumber?: string | null;
  email?: string | null;
}

export interface UpdateUserRequest {
  fullName: string;
  role: ApiRole;
  phoneNumber?: string | null;
  email?: string | null;
}

async function authFetch<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  });

  // No-content responses
  if (res.status === 204) return undefined as T;

  const text = await res.text();

  // Empty body — treat as success if status OK, else throw
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

export const getUsers = (token: string): Promise<UserResponse[]> =>
  authFetch('/api/users', token);

export const createUser = (payload: CreateUserRequest, token: string): Promise<UserResponse> =>
  authFetch('/api/users', token, { method: 'POST', body: JSON.stringify(payload) });

export const updateUser = (id: string, payload: UpdateUserRequest, token: string): Promise<UserResponse> =>
  authFetch(`/api/users/${id}`, token, { method: 'PUT', body: JSON.stringify(payload) });

export const deleteUser = (id: string, token: string): Promise<void> =>
  authFetch(`/api/users/${id}`, token, { method: 'DELETE' });

export interface AssignRoleRequest {
  role: ApiRole;
}

export const assignRole = (id: string, payload: AssignRoleRequest, token: string): Promise<void> =>
  authFetch(`/api/users/${id}/role`, token, { method: 'PATCH', body: JSON.stringify(payload) });

export const unlockUser = (id: string, token: string): Promise<void> =>
  authFetch(`/api/users/${id}/unlock`, token, { method: 'PATCH' });