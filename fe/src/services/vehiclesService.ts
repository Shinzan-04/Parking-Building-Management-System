const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5237';

export interface VehicleResponse {
  id: string;
  plateNumber: string;
  vehicleTypeId: string;
  vehicleTypeName: string;
  isPrimary: boolean;
  createdAt: string;
}

export interface CreateVehicleRequest {
  plateNumber: string;
  vehicleTypeId: string;
}

export interface UpdateVehicleRequest {
  plateNumber: string;
  vehicleTypeId: string;
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

export const getMyVehicles = (token: string): Promise<VehicleResponse[]> =>
  authFetch('/api/Vehicles/my-vehicles', token);

export const createVehicle = (payload: CreateVehicleRequest, token: string): Promise<VehicleResponse> =>
  authFetch('/api/Vehicles', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateVehicle = (id: string, payload: UpdateVehicleRequest, token: string): Promise<VehicleResponse> =>
  authFetch(`/api/Vehicles/${id}`, token, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

export const deleteVehicle = (id: string, token: string): Promise<{ message: string }> =>
  authFetch(`/api/Vehicles/${id}`, token, {
    method: 'DELETE',
  });

export const setPrimaryVehicle = (id: string, token: string): Promise<{ message: string }> =>
  authFetch(`/api/Vehicles/${id}/set-primary`, token, {
    method: 'PUT',
  });
