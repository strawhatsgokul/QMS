export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  department?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'admin' | 'staff' | 'viewer';

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}

export interface JWTPayload {
  sub: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export interface Permission {
  action: string;
  resource: string;
  description?: string;
}

export interface RolePermissions {
  [key: string]: Permission[];
}
