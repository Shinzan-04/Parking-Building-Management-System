const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5237';

export interface BuildingResponse {
  id: string;
  name: string;
  address: string;
  totalCapacity: number;
  floorCount: number;
  approvalMode: number;
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
  slotNumber?: string;
  vehicleTypeName?: string;
  vehicleTypeId?: string;
  currentLicensePlate?: string;
}

export function isSlotOccupied(status: string | number): boolean {
  return status === 'Occupied' || status === 1 || status === 'Reserved' || status === 2;
}

export function isSlotMaintenance(status: string | number): boolean {
  return status === 'Maintenance' || status === 3;
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

export const getBuildingById = (id: string, token: string): Promise<BuildingResponse> =>
  apiFetch(`/api/buildings/${id}`, undefined, token);

export const createBuilding = (payload: CreateBuildingRequest, token: string): Promise<BuildingResponse> =>
  apiFetch('/api/buildings', { method: 'POST', body: JSON.stringify(payload) }, token);

export const updateBuilding = (id: string, payload: UpdateBuildingRequest, token: string): Promise<BuildingResponse> =>
  apiFetch(`/api/buildings/${id}`, { method: 'PUT', body: JSON.stringify(payload) }, token);

export const updateBuildingApprovalMode = (id: string, mode: number, token: string): Promise<BuildingResponse> =>
  apiFetch(`/api/buildings/${id}/approval-mode`, { method: 'PUT', body: JSON.stringify(mode) }, token);

export const deleteBuilding = (id: string, token: string): Promise<void> =>
  apiFetch(`/api/buildings/${id}`, { method: 'DELETE' }, token);

export interface CreateFloorRequest {
  buildingId: string;
  name: string;
  floorIndex: number;
}

export const getFloors = (): Promise<FloorResponse[]> =>
  apiFetch('/api/floors');

export const getFloorsByBuilding = (buildingId: string): Promise<FloorResponse[]> =>
  apiFetch(`/api/floors/building/${buildingId}`);

export const createFloor = (payload: CreateFloorRequest, token: string): Promise<FloorResponse> =>
  apiFetch('/api/floors', { method: 'POST', body: JSON.stringify(payload) }, token);

export const updateFloor = (id: string, payload: { name: string, floorIndex: number }, token: string): Promise<FloorResponse> =>
  apiFetch(`/api/floors/${id}`, { method: 'PUT', body: JSON.stringify(payload) }, token);

export const deleteFloor = (id: string, token: string): Promise<void> =>
  apiFetch(`/api/floors/${id}`, { method: 'DELETE' }, token);

export interface VehicleTypeResponse {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface CreateParkingSlotRequest {
  floorId: string;
  vehicleTypeId: string;
  slotNumber: string;
}

export const getVehicleTypes = (): Promise<VehicleTypeResponse[]> =>
  apiFetch('/api/VehicleTypes');

export const createParkingSlot = (payload: CreateParkingSlotRequest, token: string): Promise<ParkingSlotSummary> =>
  apiFetch('/api/parkingslots', { method: 'POST', body: JSON.stringify(payload) }, token);

export const getParkingSlots = (): Promise<ParkingSlotSummary[]> =>
  apiFetch('/api/parkingslots');

export const getParkingSlotsByBuilding = (buildingId: string): Promise<ParkingSlotSummary[]> =>
  apiFetch(`/api/parkingslots?buildingId=${buildingId}`);

export interface StaffResponse {
  id: string;
  username: string;
  fullName: string;
  email?: string | null;
  phoneNumber?: string | null;
  createdAt: string;
  assignedBuildingId?: string | null;
}

export const getBuildingStaff = (buildingId: string, token: string): Promise<StaffResponse[]> =>
  apiFetch(`/api/buildings/${buildingId}/staff`, undefined, token);

export const assignStaffToBuilding = (buildingId: string, staffId: string, token: string): Promise<void> =>
  apiFetch(`/api/buildings/${buildingId}/staff/${staffId}`, { method: 'POST' }, token);

export const unassignStaffFromBuilding = (buildingId: string, staffId: string, token: string): Promise<void> =>
  apiFetch(`/api/buildings/${buildingId}/staff/${staffId}`, { method: 'DELETE' }, token);