import { apiClient } from './apiClient';


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


export const getUsers = (): Promise<UserResponse[]> =>
  apiClient('/api/users');

export const createUser = (payload: CreateUserRequest): Promise<UserResponse> =>
  apiClient('/api/users', { method: 'POST', body: JSON.stringify(payload) });

export const updateUser = (id: string, payload: UpdateUserRequest): Promise<UserResponse> =>
  apiClient(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) });

export const deleteUser = (id: string): Promise<void> =>
  apiClient(`/api/users/${id}`, { method: 'DELETE' });

export interface AssignRoleRequest {
  role: ApiRole;
}

export const assignRole = (id: string, payload: AssignRoleRequest): Promise<void> =>
  apiClient(`/api/users/${id}/role`, { method: 'PATCH', body: JSON.stringify(payload) });

export const unlockUser = (id: string): Promise<void> =>
  apiClient(`/api/users/${id}/unlock`, { method: 'PATCH' });