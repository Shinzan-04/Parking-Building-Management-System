import { apiClient } from './apiClient';


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


export const getMyVehicles = (): Promise<VehicleResponse[]> =>
  apiClient('/api/Vehicles/my-vehicles');

export const createVehicle = (payload: CreateVehicleRequest): Promise<VehicleResponse> =>
  apiClient('/api/Vehicles', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateVehicle = (id: string, payload: UpdateVehicleRequest): Promise<VehicleResponse> =>
  apiClient(`/api/Vehicles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

export const deleteVehicle = (id: string): Promise<{ message: string }> =>
  apiClient(`/api/Vehicles/${id}`, {
    method: 'DELETE',
  });

export const setPrimaryVehicle = (id: string): Promise<{ message: string }> =>
  apiClient(`/api/Vehicles/${id}/set-primary`, {
    method: 'PUT',
  });
