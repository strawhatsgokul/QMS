'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { ProductivityMetrics, ApplicationUsage, CategorizedTime, HourlyActivity } from '@veyon-aw/shared';
import { formatDuration, downloadJson } from '@/lib/utils';
import { apiPost } from '@/lib/api';
import { useState, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { Download, Calendar, Monitor, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { ActivityWatchInstance, ImportedDayData } from '@veyon-aw/shared';

type Period = 'day' | 'week' | 'month' | 'custom';

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('day');
  const [instanceId, setInstanceId] = useState<string>('');
  const [exporting, setExporting] = useState(false);
const [importing, setImporting] = useState(false);
const [importMsg, setImportMsg] = useState<string | null>(null);
const [showImported, setShowImported] = useState(false);
const [customStart, setCustomStart] = useState(() => {
  const d = new Date(); d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
});
const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split('T')[0]);

const queryParams = {
  period,
  start: period === 'custom' ? `${customStart}T00:00:00.000Z` : undefined,
  end: period === 'custom' ? `${customEnd}T23:59:59.999Z` : undefined,
  instanceId: instanceId || undefined,
};

  const { data: instances } = useQuery({
    queryKey: ['aw-instances'],
    queryFn: () => apiGet<ActivityWatchInstance[]>('/activity/instances'),
  });

  const { data: metrics } = useQuery({
    queryKey: ['analytics', period, instanceId, customStart, customEnd],
    queryFn: () => apiGet<ProductivityMetrics>('/activity/metrics', queryParams),
    enabled: !showImported,
  });

  const { data: applications } = useQuery({
    queryKey: ['applications', period, instanceId, customStart, customEnd],
    queryFn: () => apiGet<ApplicationUsage[]>('/activity/applications', queryParams),
    enabled: !showImported,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories', period, instanceId, customStart, customEnd],
    queryFn: () => apiGet<CategorizedTime[]>('/activity/categories', queryParams),
    enabled: !showImported,
  });

  const { data: importedDays } = useQuery({
    queryKey: ['imported', period, instanceId, customStart, customEnd],
    queryFn: () => apiGet<ImportedDayData[]>('/activity/imported', queryParams),
    enabled: showImported,
  });

  const importedMetrics = importedDays?.reduce<{
    totalActive: number; totalAfk: number; focusTime: number;
    apps: ApplicationUsage[]; categories: CategorizedTime[]; hourly: HourlyActivity[];
  }>((acc, day) => ({ ...acc,
    totalActive: acc.totalActive + day.totalActive,
    totalAfk: acc.totalAfk + day.totalAfk,
    apps: [...acc.apps, ...day.apps],
  }), { totalActive: 0, totalAfk: 0, focusTime: 0, apps: [], categories: [], hourly: [] });

  const displayMetrics = showImported && importedDays?.length ? {
    totalActiveTime: importedMetrics!.totalActive,
    totalAFKTime: importedMetrics!.totalAfk,
    focusTime: importedMetrics!.totalActive,
    totalIdleTime: 0,
    topApplications: importedMetrics!.apps.reduce<ApplicationUsage[]>((acc, app) => {
      const existing = acc.find(a => a.app === app.app);
      if (existing) { existing.duration += app.duration; } else { acc.push({ ...app }); }
      return acc;
    }, []).sort((a, b) => b.duration - a.duration).slice(0, 20),
    hourlyBreakdown: importedDays.flatMap(d => d.hourlyBreakdown),
    categorizedTime: importedDays.flatMap(d => d.categories),
  } : undefined;

  const periods: Period[] = ['day', 'week', 'month', 'custom'];

  const handleImport = useCallback(async () => {
    setImporting(true);
    setImportMsg(null);
    try {
      const result = await apiPost<{ days: { date: string }[] }>('/activity/import', queryParams);
      setImportMsg(`Imported ${result.days.length} day(s) of data`);
      setTimeout(() => setImportMsg(null), 4000);
    } catch (err) {
      setImportMsg(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTimeout(() => setImportMsg(null), 5000);
    } finally {
      setImporting(false);
    }
  }, [period, instanceId, customStart, customEnd]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/activity/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ ...queryParams, format: 'html' }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const dateStr = new Date().toISOString().split('T')[0];
      const label = period === 'custom' ? `${customStart}-${customEnd}` : period;
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-report-${label}-${dateStr}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [period, instanceId, customStart, customEnd]);

  const CATEGORY_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280'];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-surface-900">Analytics</h1>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${showImported ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                {showImported ? 'Saved Data' : 'Live'}
              </span>
            </div>
            <p className="mt-1 text-sm text-surface-500">
              Activity tracking and productivity insights
            </p>
          </div>
          <div className="flex items-center gap-3">
            {(instances && instances.length > 0) && (
              <div className="flex items-center gap-2">
                <Monitor size={16} className="text-surface-400" />
                <select
                  value={instanceId}
                  onChange={(e) => setInstanceId(e.target.value)}
                  className="rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-sm text-surface-700 focus:border-primary-500 focus:outline-none"
                >
                  <option value="">All instances</option>
                  {instances.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name} ({inst.hostname})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleImport} disabled={importing}>
              {importing ? 'Importing...' : <><Upload size={16} /> Import</>}
            </Button>
            {importMsg && (
              <span className="text-xs text-green-600 font-medium">{importMsg}</span>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs text-surface-400">Saved</span>
              <button
                onClick={() => setShowImported(!showImported)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showImported ? 'bg-primary-600' : 'bg-surface-300'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${showImported ? 'translate-x-4.5' : 'translate-x-1'}`} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border bg-white p-0.5">
                {periods.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      period === p
                        ? 'bg-primary-600 text-white'
                        : 'text-surface-600 hover:bg-surface-100'
                    }`}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
              {period === 'custom' && (
                <div className="flex items-center gap-1 text-sm">
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="rounded border border-surface-200 px-2 py-1.5 text-surface-700 focus:border-primary-500 focus:outline-none"
                  />
                  <span className="text-surface-400">to</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="rounded border border-surface-200 px-2 py-1.5 text-surface-700 focus:border-primary-500 focus:outline-none"
                  />
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
              {exporting ? 'Exporting...' : <><Download size={16} /> Export</>}
            </Button>
          </div>
        </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-surface-500">Active Time</p>
                <p className="mt-1 text-2xl font-bold">
                  {formatDuration(showImported && displayMetrics ? displayMetrics.totalActiveTime : metrics?.totalActiveTime ?? 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-surface-500">AFK Time</p>
                <p className="mt-1 text-2xl font-bold">
                  {formatDuration(showImported && displayMetrics ? displayMetrics.totalAFKTime : metrics?.totalAFKTime ?? 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-surface-500">Focus Time</p>
                <p className="mt-1 text-2xl font-bold">
                  {formatDuration(showImported && displayMetrics ? displayMetrics.focusTime : metrics?.focusTime ?? 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-surface-500">Productivity</p>
                <p className="mt-1 text-2xl font-bold">
                  {showImported && displayMetrics
                    ? Math.round((displayMetrics.focusTime / (displayMetrics.totalActiveTime || 1)) * 100)
                    : metrics?.totalActiveTime
                      ? Math.round((metrics.focusTime / metrics.totalActiveTime) * 100)
                      : 0}%
                </p>
              </CardContent>
            </Card>
          </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Hourly Activity</h2>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={showImported && displayMetrics ? displayMetrics.hourlyBreakdown : metrics?.hourlyBreakdown ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '0.5rem',
                      border: '1px solid #e2e8f0',
                    }}
                    formatter={(value: number) => formatDuration(value)}
                  />
                  <Bar dataKey="active" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Active" />
                  <Bar dataKey="afk" fill="#F59E0B" radius={[4, 4, 0, 0]} name="AFK" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Category Distribution</h2>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={showImported && displayMetrics ? displayMetrics.categorizedTime : categories ?? []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="percentage"
                    nameKey="category"
                    label={({ category, percentage }) =>
                      `${category} ${percentage}%`
                    }
                  >
                    {(showImported && displayMetrics ? displayMetrics.categorizedTime : categories ?? []).map((entry, index) => (
                      <Cell
                        key={entry.category}
                        fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Top Applications</h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(showImported && displayMetrics ? displayMetrics.topApplications : applications ?? []).slice(0, 10).map((app, index) => (
                  <div key={app.app} className="flex items-center gap-4">
                    <span className="w-6 text-sm font-medium text-surface-400">
                      #{index + 1}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-surface-700">
                          {app.app}
                        </span>
                        <span className="text-sm text-surface-500">
                          {formatDuration(app.duration)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-200">
                        <div
                          className="h-2 rounded-full bg-primary-500 transition-all"
                          style={{ width: `${app.percentage}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-surface-400">{app.percentage}%</span>
                  </div>
                ))}
                {(!(showImported && displayMetrics ? displayMetrics.topApplications : applications) || (showImported && displayMetrics ? displayMetrics.topApplications : applications ?? []).length === 0) && (
                  <p className="py-8 text-center text-surface-400">
                    No application data available for this period
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Productivity Trend</h2>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                  <LineChart
                    data={showImported && displayMetrics ? displayMetrics.hourlyBreakdown : metrics?.hourlyBreakdown ?? []}
                  >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '0.5rem',
                      border: '1px solid #e2e8f0',
                    }}
                    formatter={(value: number) => formatDuration(value)}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="productive"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={false}
                    name="Productive"
                  />
                  <Line
                    type="monotone"
                    dataKey="active"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={false}
                    name="Active"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
