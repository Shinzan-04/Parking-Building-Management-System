// ─── Types ─────────────────────────────────────────────────────────────────

export interface ScanPlateResponse {
  isDetected: boolean;
  licensePlate: string;
  confidence: number;
  croppedPlateBase64: string;
  message: string;
}

export interface ScanAndCheckInResponse {
  licensePlate: string;
  confidence: number;
  croppedPlateBase64: string;
  message: string;
  vehicleTypeId: string;
  hint: string;
}

// ─── Config ─────────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5237';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function post<TBody, TResponse>(
  path: string,
  body: TBody,
  token?: string
): Promise<TResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  // Kiểm tra content-type
  const contentType = res.headers.get('content-type');
  const isJson = contentType?.includes('application/json');

  if (!res.ok) {
    let errorMessage = `API Error: ${res.status} ${res.statusText}`;
    
    if (isJson) {
      try {
        const error = await res.json();
        errorMessage = error.message || errorMessage;
      } catch {
        errorMessage = `${errorMessage} - Invalid JSON in error response`;
      }
    } else {
      errorMessage = `${errorMessage} - Response is not JSON. Make sure backend is running at ${BASE_URL}`;
    }
    
    throw new Error(errorMessage);
  }

  // Parse response
  try {
    return await res.json();
  } catch (error) {
    throw new Error(
      `Failed to parse JSON response. Backend may not be running or API returned invalid data. URL: ${BASE_URL}${path}`
    );
  }
}

// ─── Services ───────────────────────────────────────────────────────────────

export async function scanPlate(
  imageBase64: string,
  token?: string | null
): Promise<ScanPlateResponse> {
  return post<{ ImageBase64: string }, ScanPlateResponse>(
    '/api/Ocr/scan-plate',
    { ImageBase64: imageBase64 },
    token ?? undefined
  );
}

export async function scanAndCheckIn(
  imageBase64: string,
  vehicleTypeId: string,
  token?: string | null
): Promise<ScanAndCheckInResponse> {
  return post<
    { ImageBase64: string; VehicleTypeId: string },
    ScanAndCheckInResponse
  >(
    '/api/Ocr/scan-and-checkin',
    { ImageBase64: imageBase64, VehicleTypeId: vehicleTypeId },
    token ?? undefined
  );
}
