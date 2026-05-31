export interface DashboardStats {
  totalComputers: number;
  onlineComputers: number;
  offlineComputers: number;
  lockedComputers: number;
  activeUsers: number;
  totalRooms: number;
  todayActivityMinutes: number;
  alerts: Alert[];
}

export interface Alert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  source?: 'veyon' | 'activitywatch' | 'system';
}

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  action: string;
  requiresConfirmation: boolean;
  allowedRoles: string[];
}

export interface NotificationPreference {
  id: string;
  type: string;
  enabled: boolean;
  channels: ('email' | 'in_app' | 'webhook')[];
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  veyon: ServiceStatus;
  activityWatch: ServiceStatus;
  database: ServiceStatus;
  redis: ServiceStatus;
  uptime: number;
  lastChecked: string;
}

export interface ServiceStatus {
  status: 'connected' | 'disconnected' | 'error';
  latency?: number;
  lastError?: string;
  lastConnected?: string;
}
