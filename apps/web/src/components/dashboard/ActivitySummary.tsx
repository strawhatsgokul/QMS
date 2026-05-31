'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { ProductivityMetrics } from '@veyon-aw/shared';
import { formatDuration } from '@/lib/utils';
import { Clock, Coffee, Target } from 'lucide-react';

export function ActivitySummary() {
  const { data: metrics } = useQuery({
    queryKey: ['activity-metrics'],
    queryFn: () => apiGet<ProductivityMetrics>('/activity/metrics', { period: 'day' }),
    refetchInterval: 60000,
  });

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Today&apos;s Activity</h2>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg bg-blue-50 p-3">
          <div className="rounded-lg bg-blue-100 p-2">
            <Clock size={18} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-blue-600">Active Time</p>
            <p className="text-lg font-semibold text-blue-900">
              {formatDuration(metrics?.totalActiveTime ?? 0)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg bg-amber-50 p-3">
          <div className="rounded-lg bg-amber-100 p-2">
            <Coffee size={18} className="text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-amber-600">AFK Time</p>
            <p className="text-lg font-semibold text-amber-900">
              {formatDuration(metrics?.totalAFKTime ?? 0)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg bg-green-50 p-3">
          <div className="rounded-lg bg-green-100 p-2">
            <Target size={18} className="text-green-600" />
          </div>
          <div>
            <p className="text-xs text-green-600">Focus Time</p>
            <p className="text-lg font-semibold text-green-900">
              {formatDuration(metrics?.focusTime ?? 0)}
            </p>
          </div>
        </div>

        <div className="border-t pt-4">
          <p className="mb-2 text-sm font-medium text-surface-700">Top Applications</p>
          <div className="space-y-2">
            {metrics?.topApplications?.slice(0, 5).map((app) => (
              <div key={app.app} className="flex items-center justify-between text-sm">
                <span className="truncate text-surface-600">{app.app}</span>
                <span className="font-medium text-surface-900">
                  {formatDuration(app.duration)}
                </span>
              </div>
            ))}
            {(!metrics?.topApplications || metrics.topApplications.length === 0) && (
              <p className="text-sm text-surface-400">No activity data available</p>
            )}
          </div>
        </div>

        <div className="border-t pt-4">
          <p className="mb-2 text-sm font-medium text-surface-700">Categories</p>
          <div className="space-y-2">
            {metrics?.categorizedTime?.map((cat) => (
              <div key={cat.category} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-surface-600">{cat.category}</span>
                  <span className="font-medium text-surface-900">{cat.percentage}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-200">
                  <div
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: `${cat.percentage}%`,
                      backgroundColor: cat.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
