export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: PaginationMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface WebSocketEvent {
  event: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export type WebSocketEvents = {
  'computer:status': { computerId: string; status: string };
  'computer:screen': { computerId: string; thumbnail: string };
  'computer:user': { computerId: string; username: string };
  'activity:update': { bucketId: string; eventCount: number };
  'alert:new': import('./dashboard').Alert;
  'system:health': import('./dashboard').SystemHealth;
};
