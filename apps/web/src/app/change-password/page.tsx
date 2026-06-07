'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Lock, Shield } from 'lucide-react';
import api from '@/lib/api';

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const { data } = await api.post('/auth/change-password', { currentPassword, newPassword });
      localStorage.setItem('access_token', data.data.accessToken);
      localStorage.setItem('refresh_token', data.data.refreshToken);
      if (user) {
        setAuth({ ...user, mustChangePassword: false }, data.data.accessToken);
      }
      router.push('/');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr?.response?.data?.error?.message || (err instanceof Error ? err.message : 'Password change failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 to-surface-100 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          <div className="mb-8 text-center">
            <div className="mb-4 flex items-center justify-center gap-3">
              <div className="rounded-xl bg-primary-100 p-3">
                <Shield size={28} className="text-primary-600" />
              </div>
              <div className="rounded-xl bg-green-100 p-3">
                <Lock size={28} className="text-green-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-surface-900">Change Password</h1>
            <p className="mt-1 text-sm text-surface-500">
              You must change your password before continuing
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border border-surface-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-surface-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                placeholder="At least 8 characters"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-surface-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                required
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full">
              Change Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
