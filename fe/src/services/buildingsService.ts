import { apiClient } from './apiClient';


export interface BuildingResponse {
  id: string;
  name: string;
  address: string;
  totalCapacity: number;
  availableSpots?: number;
  floorCount: number;
  approvalMode: number | string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
}

export interface CreateBuildingRequest {
  name: string;
  address: string;
  totalCapacity: number;
  latitude?: number;
  longitude?: number;
}

export interface UpdateBuildingRequest {
  name: string;
  address: string;
  totalCapacity: number;
  latitude?: number;
  longitude?: number;
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
  return status === 'Occupied' || status === 3 || status === 'Reserved' || status === 2;
}

export function isSlotMaintenance(status: string | number): boolean {
  return status === 'Maintenance' || status === 4;
}


export const getBuildings = (): Promise<BuildingResponse[]> =>
  apiClient('/api/buildings');

export const getBuildingById = (id: string): Promise<BuildingResponse> =>
  apiClient(`/api/buildings/${id}`);

export const createBuilding = (payload: CreateBuildingRequest): Promise<BuildingResponse> =>
  apiClient('/api/buildings', { method: 'POST', body: JSON.stringify(payload) });

export const updateBuilding = (id: string, payload: UpdateBuildingRequest): Promise<BuildingResponse> =>
  apiClient(`/api/buildings/${id}`, { method: 'PUT', body: JSON.stringify(payload) });

export const updateBuildingApprovalMode = (id: string, mode: number): Promise<BuildingResponse> =>
  apiClient(`/api/buildings/${id}/approval-mode`, { method: 'PUT', body: JSON.stringify(mode) });

export const deleteBuilding = (id: string): Promise<void> =>
  apiClient(`/api/buildings/${id}`, { method: 'DELETE' });

export interface CreateFloorRequest {
  buildingId: string;
  name: string;
  floorIndex: number;
}

export const getFloors = (): Promise<FloorResponse[]> =>
  apiClient('/api/floors');

export const getFloorsByBuilding = (buildingId: string): Promise<FloorResponse[]> =>
  apiClient(`/api/floors/building/${buildingId}`);

export const createFloor = (payload: CreateFloorRequest): Promise<FloorResponse> =>
  apiClient('/api/floors', { method: 'POST', body: JSON.stringify(payload) });

export const updateFloor = (id: string, payload: { name: string, floorIndex: number }): Promise<FloorResponse> =>
  apiClient(`/api/floors/${id}`, { method: 'PUT', body: JSON.stringify(payload) });

export const deleteFloor = (id: string): Promise<void> =>
  apiClient(`/api/floors/${id}`, { method: 'DELETE' });

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
  apiClient('/api/VehicleTypes');

export const createVehicleType = (payload: { name: string; description?: string }): Promise<VehicleTypeResponse> =>
  apiClient('/api/VehicleTypes', { method: 'POST', body: JSON.stringify(payload) });

export const updateVehicleType = (id: string, payload: { name: string; description?: string }): Promise<VehicleTypeResponse> =>
  apiClient(`/api/VehicleTypes/${id}`, { method: 'PUT', body: JSON.stringify(payload) });

export const deleteVehicleType = (id: string): Promise<void> =>
  apiClient(`/api/VehicleTypes/${id}`, { method: 'DELETE' });

export const createParkingSlot = (payload: CreateParkingSlotRequest): Promise<ParkingSlotSummary> =>
  apiClient('/api/parkingslots', { method: 'POST', body: JSON.stringify(payload) });

export const getParkingSlots = (): Promise<ParkingSlotSummary[]> =>
  apiClient('/api/parkingslots');

export const getParkingSlotsByBuilding = (buildingId: string): Promise<ParkingSlotSummary[]> =>
  apiClient(`/api/parkingslots?buildingId=${buildingId}`);

export interface CurrentVehicleResponse {
  licensePlate: string | null;
  status: string;
  expectedEndTime: string | null;
  driverId?: string;
  driverName?: string;
  phoneNumber?: string;
}

export const getCurrentVehicle = (slotId: string): Promise<CurrentVehicleResponse> =>
  apiClient(`/api/parkingslots/${slotId}/current-vehicle`);

export interface StaffResponse {
  id: string;
  username: string;
  fullName: string;
  email?: string | null;
  phoneNumber?: string | null;
  createdAt: string;
  assignedBuildingId?: string | null;
}

export const getBuildingStaff = (buildingId: string): Promise<StaffResponse[]> =>
  apiClient(`/api/buildings/${buildingId}/staff`);

export const assignStaffToBuilding = (buildingId: string, staffId: string): Promise<void> =>
  apiClient(`/api/buildings/${buildingId}/staff/${staffId}`, { method: 'POST' });

export const unassignStaffFromBuilding = (buildingId: string, staffId: string): Promise<void> =>
  apiClient(`/api/buildings/${buildingId}/staff/${staffId}`, { method: 'DELETE' });