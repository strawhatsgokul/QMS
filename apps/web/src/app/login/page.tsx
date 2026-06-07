'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Monitor, Activity } from 'lucide-react';
import api from '@/lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('access_token', data.data.accessToken);
      localStorage.setItem('refresh_token', data.data.refreshToken);
      setAuth(data.data.user, data.data.accessToken);
      if (data.data.user.mustChangePassword) {
        router.push('/change-password');
      } else {
        router.push('/');
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr?.response?.data?.error?.message || (err instanceof Error ? err.message : 'Login failed'));
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
                <Monitor size={28} className="text-primary-600" />
              </div>
              <div className="rounded-xl bg-green-100 p-3">
                <Activity size={28} className="text-green-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-surface-900">QMS Dashboard</h1>
            <p className="mt-1 text-sm text-surface-500">
              Veyon & ActivityWatch Integration
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-surface-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
