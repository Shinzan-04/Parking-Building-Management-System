import { apiClient } from './apiClient';


export interface AuditLogDto {
  id: string;
  userId: string;
  actionType: string;
  entityName: string;
  entityId: string | null;
  oldValues: string | null;
  newValues: string | null;
  reason: string | null;
  ipAddress: string | null;
  createdAt: string;
  userFullName: string | null;
}


export const getAuditLogs = (): Promise<AuditLogDto[]> =>
  apiClient('/api/AuditLogs');
