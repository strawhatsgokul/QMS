import type { RolePermissions } from '../types/auth';

export const ROLES = {
  ADMIN: 'admin' as const,
  STAFF: 'staff' as const,
  VIEWER: 'viewer' as const,
} as const;

export const ROLE_PERMISSIONS: RolePermissions = {
  admin: [
    { action: 'manage:all', resource: '*', description: 'Full system access' },
    { action: 'read:computers', resource: 'computers', description: 'View all computers' },
    { action: 'write:computers', resource: 'computers', description: 'Manage computers' },
    { action: 'control:computers', resource: 'computers', description: 'Remote control computers' },
    { action: 'read:activity', resource: 'activity', description: 'View activity data' },
    { action: 'export:activity', resource: 'activity', description: 'Export activity data' },
    { action: 'manage:users', resource: 'users', description: 'Manage user accounts' },
    { action: 'manage:settings', resource: 'settings', description: 'Manage system settings' },
    { action: 'read:logs', resource: 'logs', description: 'View audit logs' },
  ],
  staff: [
    { action: 'read:computers', resource: 'computers', description: 'View assigned computers' },
    { action: 'control:computers', resource: 'computers', description: 'Control classroom computers' },
    { action: 'read:activity', resource: 'activity', description: 'View student activity' },
    { action: 'export:activity', resource: 'activity', description: 'Export activity reports' },
    { action: 'manage:own:settings', resource: 'settings', description: 'Manage personal settings' },
  ],
  viewer: [
    { action: 'read:computers', resource: 'computers', description: 'View computer list' },
    { action: 'read:activity', resource: 'activity', description: 'View activity data' },
  ],
};

export const ROLE_LABELS = {
  admin: 'Administrator',
  staff: 'Staff',
  viewer: 'Viewer',
} as const;
