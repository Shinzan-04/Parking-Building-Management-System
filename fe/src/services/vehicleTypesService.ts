import { apiClient } from './apiClient';


export interface VehicleTypeResponse {
  id: string;
  name: string;
  description?: string;
  baseRate: number; // Phí cơ bản nếu có
  createdAt?: string;
}


export const getVehicleTypes = (): Promise<VehicleTypeResponse[]> =>
  apiClient('/api/VehicleTypes');
