const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5237';

export interface BuildingResponse {
  id: string;
  name: string;
  address: string;
  totalCapacity: number;
  floorCount: number;
  createdAt: string;
}

export interface CreateBuildingRequest {
  name: string;
  address: string;
  totalCapacity: number;
}

export interface UpdateBuildingRequest {
  name: string;
  address: string;
  totalCapacity: number;
}

export interface FloorResponse {
  id: string;
  buildingId: string;
  buildingName: string;
  name: string;
  floorIndex: number;
  slotCount: number;
  createdAt: string;
}

// SlotStatus enum: Available=0, Occupied=1, Reserved=2, Maintenance=3
export interface ParkingSlotSummary {
  id: string;
  floorId: string;
  status: string | number;
}

export function isSlotOccupied(status: string | number): boolean {
  return status === 'Occupied' || status === 1 || status === 'Reserved' || status === 2;
}

async function apiFetch<T>(path: string, options?: RequestInit, token?: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    throw new Error((data as { message?: string }).message ?? `Yêu cầu thất bại (${res.status}).`);
  }
  return data as T;
}

export const getBuildings = (): Promise<BuildingResponse[]> =>
  apiFetch('/api/buildings');

export const createBuilding = (payload: CreateBuildingRequest, token: string): Promise<BuildingResponse> =>
  apiFetch('/api/buildings', { method: 'POST', body: JSON.stringify(payload) }, token);

export const updateBuilding = (id: string, payload: UpdateBuildingRequest, token: string): Promise<BuildingResponse> =>
  apiFetch(`/api/buildings/${id}`, { method: 'PUT', body: JSON.stringify(payload) }, token);

export const deleteBuilding = (id: string, token: string): Promise<void> =>
  apiFetch(`/api/buildings/${id}`, { method: 'DELETE' }, token);

export const getFloors = (): Promise<FloorResponse[]> =>
  apiFetch('/api/floors');

export const getParkingSlots = (): Promise<ParkingSlotSummary[]> =>
  apiFetch('/api/parkingslots');