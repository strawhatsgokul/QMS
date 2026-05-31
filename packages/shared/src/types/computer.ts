export interface Computer {
  id: string;
  hostname: string;
  ipAddress: string;
  macAddress?: string;
  roomId: string;
  status: ComputerStatus;
  currentUser?: string;
  lastSeen?: string;
  os?: string;
  veyonVersion?: string;
  room?: Room;
  createdAt: string;
  updatedAt: string;
}

export type ComputerStatus = 'online' | 'offline' | 'locked' | 'sleeping' | 'error';

export interface Room {
  id: string;
  name: string;
  description?: string;
  location?: string;
  computerCount: number;
  onlineCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ComputerGroup {
  id: string;
  name: string;
  description?: string;
  computerIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ScreenPreview {
  computerId: string;
  thumbnail: string;
  timestamp: string;
}

export interface PowerAction {
  computerId: string;
  action: 'restart' | 'shutdown' | 'wake' | 'lock' | 'unlock';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message?: string;
}
