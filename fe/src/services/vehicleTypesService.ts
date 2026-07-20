const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5237';

export interface VehicleTypeResponse {
  id: string;
  name: string;
  description?: string;
  baseRate: number; // Phí cơ bản nếu có
  createdAt?: string;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
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
    throw new Error('Invalid response from server.');
  }

  if (!res.ok) {
    throw new Error((data as { message?: string }).message ?? `Yêu cầu thất bại (${res.status}).`);
  }
  return data as T;
}

export const getVehicleTypes = (): Promise<VehicleTypeResponse[]> =>
  apiFetch('/api/VehicleTypes');
