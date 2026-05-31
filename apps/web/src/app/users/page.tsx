'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import type { User, UserRole } from '@veyon-aw/shared';
import { formatDate } from '@/lib/utils';
import { UserPlus, Shield, Plus, X, Check, AlertCircle, KeyRound, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ROLE_PERMISSIONS, ROLE_LABELS } from '@veyon-aw/shared';

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'viewer', department: '' });
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiGet<User[]>('/users'),
  });

  const [permUser, setPermUser] = useState<User | null>(null);
  const [resetPwdUser, setResetPwdUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: '', department: '', isActive: true });
  const [deleteUser, setDeleteUser] = useState<User | null>(null);

  const resetPwdMutation = useMutation({
    mutationFn: ({ userId, newPassword }: { userId: string; newPassword: string }) =>
      apiPost(`/users/${userId}/reset-password`, { newPassword }),
    onSuccess: () => {
      setFeedback({ type: 'success', msg: 'Password reset successfully' });
      setResetPwdUser(null);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setFeedback(null), 4000);
    },
    onError: (e: Error) => {
      setFeedback({ type: 'error', msg: `Password reset failed: ${e.message}` });
      setTimeout(() => setFeedback(null), 4000);
    },
  });

  const roleChangeMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiPatch(`/users/${userId}`, { role }),
    onSuccess: () => {
      setFeedback({ type: 'success', msg: 'User role updated' });
      setPermUser(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setTimeout(() => setFeedback(null), 4000);
    },
    onError: (e: Error) => {
      setFeedback({ type: 'error', msg: `Role update failed: ${e.message}` });
      setTimeout(() => setFeedback(null), 4000);
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: typeof editForm }) =>
      apiPatch(`/users/${userId}`, data),
    onSuccess: () => {
      setFeedback({ type: 'success', msg: 'User updated successfully' });
      setEditUser(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setTimeout(() => setFeedback(null), 4000);
    },
    onError: (e: Error) => {
      setFeedback({ type: 'error', msg: `Failed to update user: ${e.message}` });
      setTimeout(() => setFeedback(null), 4000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => apiDelete(`/users/${userId}`),
    onSuccess: () => {
      setFeedback({ type: 'success', msg: 'User deleted successfully' });
      setDeleteUser(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setTimeout(() => setFeedback(null), 4000);
    },
    onError: (e: Error) => {
      setFeedback({ type: 'error', msg: `Failed to delete user: ${e.message}` });
      setTimeout(() => setFeedback(null), 4000);
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof newUser) =>
      apiPost('/users', { ...data, department: data.department || undefined }),
    onSuccess: () => {
      setFeedback({ type: 'success', msg: 'User created successfully' });
      setShowAddModal(false);
      setNewUser({ name: '', email: '', password: '', role: 'viewer', department: '' });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setTimeout(() => setFeedback(null), 4000);
    },
    onError: (e: Error) => {
      setFeedback({ type: 'error', msg: `Failed to create user: ${e.message}` });
      setTimeout(() => setFeedback(null), 4000);
    },
  });

  const roleBadge = (role: string) => {
    const variants: Record<string, 'info' | 'success' | 'default'> = {
      admin: 'info',
      staff: 'success',
      viewer: 'default',
    };
    return <Badge variant={variants[role] ?? 'default'}>{role}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-surface-900">Users</h1>
            <p className="mt-1 text-sm text-surface-500">Manage user accounts and permissions</p>
          </div>
          <div className="flex items-center gap-2">
            {feedback && (
              <span className={`text-sm font-medium ${feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {feedback.msg}
              </span>
            )}
            <Button onClick={() => setShowAddModal(true)}>
              <UserPlus size={16} /> Add User
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-surface-50">
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-surface-500">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-surface-500">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-surface-500">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-surface-500">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-surface-500">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-surface-500">Last Login</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-surface-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(users ?? []).map((user) => (
                    <tr key={user.id} className="border-b transition-colors hover:bg-surface-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-surface-900">{user.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-surface-500">{user.email}</td>
                      <td className="px-6 py-4">{roleBadge(user.role)}</td>
                      <td className="px-6 py-4 text-sm text-surface-500">{user.department || '-'}</td>
                      <td className="px-6 py-4">
                        <Badge variant={user.isActive ? 'success' : 'danger'}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-surface-500">
                        {user.lastLogin ? formatDate(user.lastLogin) : 'Never'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setPermUser(user)}>
                            <Shield size={16} /> Permissions
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setResetPwdUser(user); setNewPassword(''); setConfirmPassword(''); }}>
                            <KeyRound size={16} /> Reset Password
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setEditUser(user); setEditForm({ name: user.name, department: user.department || '', isActive: user.isActive }); }}>
                            <Pencil size={16} /> Edit
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteUser(user)} className="text-red-600 hover:bg-red-50">
                            <Trash2 size={16} /> Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!users || users.length === 0) && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-surface-400">
                        No users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {resetPwdUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setResetPwdUser(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                  {resetPwdUser.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-surface-900">Reset Password</h2>
                  <p className="text-sm text-surface-500">{resetPwdUser.name} · {resetPwdUser.email}</p>
                </div>
              </div>
              <button onClick={() => setResetPwdUser(null)} className="text-surface-400 hover:text-surface-600"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-700">New Password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg border border-surface-300 px-4 py-2 text-sm outline-none focus:border-primary-500" placeholder="Min 8 characters" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-700">Confirm Password</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-surface-300 px-4 py-2 text-sm outline-none focus:border-primary-500" placeholder="Re-enter new password" />
              </div>
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-sm text-red-500">Passwords do not match</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setResetPwdUser(null)}>Cancel</Button>
                <Button
                  onClick={() => resetPwdMutation.mutate({ userId: resetPwdUser.id, newPassword })}
                  loading={resetPwdMutation.isPending}
                  disabled={!newPassword || newPassword.length < 8 || newPassword !== confirmPassword}
                >
                  Reset Password
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {permUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setPermUser(null)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                  {permUser.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-surface-900">{permUser.name}</h2>
                  <p className="text-sm text-surface-500">{permUser.email}</p>
                </div>
              </div>
              <button onClick={() => setPermUser(null)} className="text-surface-400 hover:text-surface-600"><X size={20} /></button>
            </div>

            <div className="mb-4 flex items-center gap-3 rounded-lg bg-surface-50 p-3">
              <span className="text-sm font-medium text-surface-700">Current Role:</span>
              <select
                value={permUser.role}
                onChange={(e) => setPermUser({ ...permUser, role: e.target.value as User['role'] })}
                className="rounded-lg border border-surface-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-primary-500"
              >
                <option value="viewer">Viewer</option>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
              {permUser.role !== ((users ?? []).find((u) => u.id === permUser.id)?.role ?? permUser.role) && (
                <Button size="sm" onClick={() => roleChangeMutation.mutate({ userId: permUser.id, role: permUser.role })} loading={roleChangeMutation.isPending}>
                  Save
                </Button>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-surface-700 uppercase tracking-wide">Privileges — {ROLE_LABELS[permUser.role as keyof typeof ROLE_LABELS]}</h3>
              <div className="divide-y rounded-lg border">
                {(ROLE_PERMISSIONS[permUser.role as keyof typeof ROLE_PERMISSIONS] ?? []).map((perm, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <Check size={18} className="mt-0.5 shrink-0 text-green-500" />
                    <div>
                      <p className="text-sm font-medium text-surface-900">{perm.description}</p>
                      <p className="text-xs text-surface-400">{perm.action} :: {perm.resource}</p>
                    </div>
                  </div>
                ))}
                {(ROLE_PERMISSIONS[permUser.role as keyof typeof ROLE_PERMISSIONS]?.length ?? 0) === 0 && (
                  <div className="flex items-center gap-3 px-4 py-6 text-surface-400">
                    <AlertCircle size={18} />
                    <p className="text-sm">No privileges defined for this role</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditUser(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-surface-900">Edit User</h2>
              <button onClick={() => setEditUser(null)} className="text-surface-400 hover:text-surface-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-700">Name</label>
                <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full rounded-lg border border-surface-300 px-4 py-2 text-sm outline-none focus:border-primary-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-700">Department</label>
                <input type="text" value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  className="w-full rounded-lg border border-surface-300 px-4 py-2 text-sm outline-none focus:border-primary-500" placeholder="e.g. Computer Science" />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="isActive" checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500" />
                <label htmlFor="isActive" className="text-sm font-medium text-surface-700">Account Active</label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
                <Button
                  onClick={() => editMutation.mutate({ userId: editUser.id, data: editForm })}
                  loading={editMutation.isPending}
                  disabled={!editForm.name}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeleteUser(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-surface-900">Delete User</h2>
                  <p className="text-sm text-surface-500">{deleteUser.name} · {deleteUser.email}</p>
                </div>
              </div>
              <button onClick={() => setDeleteUser(null)} className="text-surface-400 hover:text-surface-600"><X size={20} /></button>
            </div>
            <p className="mb-4 text-sm text-surface-600">
              Are you sure you want to delete this user? This action cannot be undone. All associated data (audit logs, notifications) will be preserved but linked to a deleted user.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteUser(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => deleteMutation.mutate(deleteUser.id)} loading={deleteMutation.isPending}>
                Delete User
              </Button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAddModal(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-surface-900">Add User</h2>
              <button onClick={() => setShowAddModal(false)} className="text-surface-400 hover:text-surface-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-700">Name</label>
                <input type="text" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full rounded-lg border border-surface-300 px-4 py-2 text-sm outline-none focus:border-primary-500" placeholder="e.g. John Doe" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-700">Email</label>
                <input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full rounded-lg border border-surface-300 px-4 py-2 text-sm outline-none focus:border-primary-500" placeholder="e.g. user@example.com" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-700">Password</label>
                <input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full rounded-lg border border-surface-300 px-4 py-2 text-sm outline-none focus:border-primary-500" placeholder="Min 8 characters" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-700">Role</label>
                <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full rounded-lg border border-surface-300 px-4 py-2 text-sm outline-none focus:border-primary-500">
                  <option value="viewer">Viewer</option>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-700">Department <span className="text-surface-400">(optional)</span></label>
                <input type="text" value={newUser.department} onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                  className="w-full rounded-lg border border-surface-300 px-4 py-2 text-sm outline-none focus:border-primary-500" placeholder="e.g. Computer Science" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button onClick={() => createMutation.mutate(newUser)} loading={createMutation.isPending} disabled={!newUser.name || !newUser.email || !newUser.password}>
                  Create User
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
