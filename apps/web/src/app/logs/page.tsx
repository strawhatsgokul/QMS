'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  ScrollText, AlertTriangle, FileText, Server,
  ChevronLeft, ChevronRight, Trash2, Search,
  RefreshCw, Loader2, Activity, Clock, Monitor,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

type Tab = 'audit' | 'error' | 'api' | 'services';

interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  user: { name: string; email: string } | null;
}

interface AuditLogResponse {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface LogFileEntry {
  name: string;
  size: number;
  modifiedAt: string;
}

interface LogFileContent {
  name: string;
  lines: string[];
  totalLines: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

interface ServiceStatus {
  status: string;
  error?: string;
}

interface ServiceHealth {
  services: Record<string, ServiceStatus>;
  uptime: number;
  startedAt: string;
  checkedAt: string;
}

const ACTION_VARIANTS: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'default'> = {
  USER_LOGIN_SUCCESS: 'success',
  USER_LOGIN_FAILURE: 'danger',
  USER_CREATED: 'success',
  USER_DELETED: 'danger',
  USER_PASSWORD_RESET: 'warning',
  VEYON_LOCK: 'warning',
  VEYON_UNLOCK: 'success',
  VEYON_RESTART: 'warning',
  VEYON_SHUTDOWN: 'danger',
  VEYON_MESSAGE: 'info',
  VEYON_FILE_COPY: 'info',
};

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'audit', label: 'Audit Logs', icon: <ScrollText size={18} /> },
  { key: 'error', label: 'Error Log', icon: <AlertTriangle size={18} /> },
  { key: 'api', label: 'API Log', icon: <FileText size={18} /> },
  { key: 'services', label: 'Services', icon: <Server size={18} /> },
];

const SERVICE_LABELS: Record<string, string> = {
  database: 'Database',
  veyon: 'Veyon WebAPI',
  activityWatch: 'ActivityWatch',
};

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  database: <Activity size={20} />,
  veyon: <Monitor size={20} />,
  activityWatch: <Clock size={20} />,
};

function actionBadge(action: string) {
  const variant = ACTION_VARIANTS[action] ?? 'default';
  return <Badge variant={variant}>{action}</Badge>;
}

function FileNameDisplay({ name }: { name: string }) {
  const isError = name === 'error.log';
  return (
    <span className="flex items-center gap-1.5">
      {isError ? <AlertTriangle size={14} className="text-red-500" /> : <FileText size={14} className="text-blue-500" />}
      {name}
    </span>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  return parts.join(' ') || '<1m';
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function AuditTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const limit = 50;

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, actionFilter],
    queryFn: () => {
      const params: Record<string, unknown> = { page, limit };
      if (actionFilter) params.action = actionFilter;
      return apiGet<AuditLogResponse>('/audit-logs', params);
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: () => apiPost<{ deleted: number }>('/audit-logs/cleanup'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['audit-logs'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" size={18} />
            <input
              type="text"
              placeholder="Filter by action..."
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-surface-200 bg-white py-2 pl-10 pr-4 text-sm outline-none focus:border-primary-500"
            />
          </div>
          <span className="text-sm text-surface-500">
            {data ? `${data.total} records` : ''}
          </span>
        </div>
        <Button variant="outline" onClick={() => cleanupMutation.mutate()} loading={cleanupMutation.isPending}>
          <Trash2 size={16} /> Cleanup Old Logs
        </Button>
      </div>

      {cleanupMutation.data && (
        <div className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">
          Deleted {cleanupMutation.data.deleted} old records
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-surface-50">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-500">Timestamp</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-500">User</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-500">Action</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-500">Resource</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-500">Details</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-500">IP</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-surface-400">Loading logs...</td>
              </tr>
            ) : data?.logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-surface-400">No audit logs found</td>
              </tr>
            ) : (
              data?.logs.map((log) => (
                <tr key={log.id} className="border-b transition-colors hover:bg-surface-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-surface-600">{formatDate(log.createdAt)}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="font-medium text-surface-900">{log.user?.name ?? log.userId}</span>
                    {log.user && <p className="text-xs text-surface-400">{log.user.email}</p>}
                  </td>
                  <td className="px-4 py-3">{actionBadge(log.action)}</td>
                  <td className="px-4 py-3 text-sm text-surface-600">{log.resource}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-sm text-surface-500">
                    {log.details ? JSON.stringify(log.details).slice(0, 80) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-surface-500">{log.ipAddress || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft size={16} /> Previous
          </Button>
          <span className="text-sm text-surface-500">Page {data.page} of {data.totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}>
            Next <ChevronRight size={16} />
          </Button>
        </div>
      )}
    </div>
  );
}

function LogFileTab({ fileName }: { fileName: string }) {
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const limit = 100;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['log-file', fileName, offset],
    queryFn: () => apiGet<LogFileContent>('/logs/files/' + fileName, { offset, limit, reverse: 'true' }),
  });

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => refetch(), 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, refetch]);

  const filteredLines = search
    ? (data?.lines ?? []).filter((l) => l.toLowerCase().includes(search.toLowerCase()))
    : (data?.lines ?? []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" size={18} />
            <input
              type="text"
              placeholder="Search in current page..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-surface-200 bg-white py-2 pl-10 pr-4 text-sm outline-none focus:border-primary-500"
            />
          </div>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors',
              autoRefresh
                ? 'border-green-300 bg-green-50 text-green-700'
                : 'border-surface-200 text-surface-500 hover:bg-surface-50'
            )}
          >
            <RefreshCw size={16} className={autoRefresh ? 'animate-spin' : ''} />
            Auto
          </button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw size={16} />
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm text-surface-500">
          <span>Lines {data ? `${Math.max(1, data.totalLines - offset - limit + 1)}-${data.totalLines - offset}` : '...'} of {data?.totalLines ?? '...'}</span>
          <span className="text-surface-300">|</span>
          <span>File size: {data ? formatBytes(data.totalLines * 80) : '...'}</span>
        </div>
      </div>

      {isError && (
        <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">Failed to load log file</div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-surface-400">
            <Loader2 size={24} className="animate-spin mr-2" /> Loading log...
          </div>
        ) : filteredLines.length === 0 ? (
          <div className="py-12 text-center text-surface-400">
            {search ? 'No matching lines found' : 'Log file is empty'}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b bg-surface-50">
                <th className="w-16 px-4 py-2 text-left text-xs font-medium uppercase text-surface-500">#</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-surface-500">Line</th>
              </tr>
            </thead>
            <tbody>
              {filteredLines.map((line, i) => {
                const lineNum = data!.totalLines - offset - filteredLines.length + i + 1;
                const isErrorLine = line.includes('error') || line.includes('Error') || line.includes('ERROR');
                return (
                  <tr key={lineNum} className={cn('border-b font-mono text-xs hover:bg-surface-50', isErrorLine && 'bg-red-50/30')}>
                    <td className="px-4 py-1.5 text-surface-400 select-none">{lineNum}</td>
                    <td className="px-4 py-1.5 text-surface-700 whitespace-pre-wrap break-all">
                      {highlightText(line, search)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" size="sm" disabled={offset + limit >= (data?.totalLines ?? 0)} onClick={() => setOffset((o) => o + limit)}>
          Load Older <ChevronLeft size={16} />
        </Button>
        <span className="text-sm text-surface-500">
          Showing last {data ? Math.min(limit, data.totalLines - offset) : 0} lines
        </span>
        <Button variant="outline" size="sm" disabled={offset <= 0} onClick={() => setOffset((o) => Math.max(0, o - limit))}>
          <ChevronRight size={16} /> Load Newer
        </Button>
      </div>
    </div>
  );
}

function ServicesTab() {
  const { data, isLoading, refetch, isError } = useQuery({
    queryKey: ['services-health'],
    queryFn: () => apiGet<ServiceHealth>('/logs/services'),
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-surface-500">
          Server started {data ? formatUptime(data.uptime) : '...'} ago
          {data && <> &middot; Last checked {formatDate(data.checkedAt)}</>}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} loading={isLoading}>
          <RefreshCw size={16} /> Refresh
        </Button>
      </div>

      {isError && (
        <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">Failed to fetch service status</div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-surface-400">
          <Loader2 size={24} className="animate-spin mr-2" /> Checking services...
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.services && Object.entries(data.services).map(([key, svc]) => (
            <Card key={key}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'rounded-lg p-2.5',
                      svc.status === 'connected' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                    )}>
                      {SERVICE_ICONS[key] ?? <Server size={20} />}
                    </div>
                    <div>
                      <p className="font-medium text-surface-900">{SERVICE_LABELS[key] ?? key}</p>
                      <Badge variant={svc.status === 'connected' ? 'success' : 'danger'}>
                        {svc.status === 'connected' ? 'Connected' : 'Error'}
                      </Badge>
                    </div>
                  </div>
                  <div className={cn(
                    'h-3 w-3 rounded-full',
                    svc.status === 'connected' ? 'bg-green-500' : 'bg-red-500'
                  )} />
                </div>
                {svc.error && (
                  <p className="mt-3 text-sm text-red-600">{svc.error}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LogsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('audit');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Logs &amp; Services</h1>
          <p className="text-sm text-surface-500">Monitor system activity, errors, API traffic, and service health</p>
        </div>

        <Card>
          <CardHeader className="border-b px-0">
            <div className="flex border-b border-surface-200 px-6">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px',
                    activeTab === tab.key
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300'
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {activeTab === 'audit' && <AuditTab />}
            {activeTab === 'error' && <LogFileTab fileName="error.log" />}
            {activeTab === 'api' && <LogFileTab fileName="combined.log" />}
            {activeTab === 'services' && <ServicesTab />}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
