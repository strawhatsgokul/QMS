'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { ComputerGrid } from '@/components/dashboard/ComputerGrid';
import { ActivitySummary } from '@/components/dashboard/ActivitySummary';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { DashboardStats, Computer } from '@veyon-aw/shared';
import { useDashboardStore } from '@/store/dashboard';
import { useUIStore } from '@/store/ui';
import { useEffect } from 'react';
import { Monitor, Users, Clock, AlertTriangle } from 'lucide-react';

export default function DashboardPage() {
  const setStats = useDashboardStore((s) => s.setStats);
  const setComputers = useDashboardStore((s) => s.setComputers);
  const setBellOpen = useUIStore((s) => s.setBellOpen);

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => apiGet<DashboardStats>('/dashboard/stats'),
    refetchInterval: 30000,
  });

  const { data: computers } = useQuery({
    queryKey: ['computers'],
    queryFn: () => apiGet<Computer[]>('/computers'),
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (stats) setStats(stats);
  }, [stats, setStats]);

  useEffect(() => {
    if (computers) setComputers(computers);
  }, [computers, setComputers]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Dashboard</h1>
          <p className="mt-1 text-sm text-surface-500">
            Overview of your classroom environment
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Online Computers"
            value={stats?.onlineComputers ?? 0}
            total={stats?.totalComputers}
            icon={Monitor}
            variant="success"
          />
          <StatCard
            title="Active Users"
            value={stats?.activeUsers ?? 0}
            icon={Users}
            variant="info"
          />
          <StatCard
            title="Activity Today"
            value={`${stats?.todayActivityMinutes ?? 0}m`}
            icon={Clock}
            variant="warning"
          />
          <StatCard
            title="Alerts"
            value={stats?.alerts?.length ?? 0}
            icon={AlertTriangle}
            variant="danger"
            onClick={() => setBellOpen(true)}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ComputerGrid computers={computers ?? []} />
          </div>
          <div>
            <ActivitySummary />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
