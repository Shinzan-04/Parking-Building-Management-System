import { apiClient } from './apiClient';


export interface WalkInRequest {
  licensePlate: string;
  vehicleTypeId: string;
  staffId?: string;
  slotId?: string;
}

export interface CheckInResult {
  sessionId: string;
  sessionCode: string;
  sessionQrCodeBase64?: string;
  licensePlate: string;
  checkInMethod: string; // 'Booking' | 'WalkIn'
  bookingCode?: string | null;
  slotNumber: string;
  floorName: string;
  buildingName: string;
  vehicleTypeName: string;
  isAIAssigned: boolean;
  slotScore?: number;
  slotReason?: string;
  entryImageUrl?: string;
  entryTime: string;
  message: string;
}


export const checkInWalkIn = (payload: WalkInRequest): Promise<CheckInResult> =>
  apiClient('/api/checkin/walk-in', { method: 'POST', body: JSON.stringify(payload) });

export interface BookingCheckInRequest {
  bookingCode: string;
  licensePlateOcr: string;
  staffId?: string;
  entryImageBase64?: string;
}

export const checkInWithBooking = (payload: BookingCheckInRequest): Promise<CheckInResult> =>
  apiClient('/api/checkin/booking', { method: 'POST', body: JSON.stringify(payload) });

// ★ SMART CHECK-IN — API duy nhất cho cổng vào ★
export interface SmartCheckInRequest {
  licensePlate: string;
  vehicleTypeId: string;
  entryImageBase64?: string;
  slotId?: string;
}

export const smartCheckIn = (payload: SmartCheckInRequest): Promise<CheckInResult> =>
  apiClient('/api/checkin/smart', { method: 'POST', body: JSON.stringify(payload) });