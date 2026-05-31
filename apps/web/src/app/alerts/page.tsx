'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, Plus, Trash2, Power, PowerOff,
  Bell, BellRing, Activity, Globe, SlidersHorizontal,
  X, CheckCheck, RefreshCw, Loader2,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface WatchRule {
  id: string;
  name: string;
  pattern: string;
  category: string;
  severity: string;
  isActive: boolean;
  notifyAdmins: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AlertDetection {
  id: string;
  ruleId: string;
  ruleName: string;
  appName: string;
  hostname: string | null;
  matchedPattern: string;
  severity: string;
  title: string;
  message: string;
  read: boolean;
  notifiedAt: string;
}

interface DetectionsResponse {
  detections: AlertDetection[];
  unreadCount: number;
}

const SEVERITY_STYLES: Record<string, string> = {
  error: 'border-l-red-500 bg-red-50/50',
  warning: 'border-l-yellow-500 bg-yellow-50/50',
  info: 'border-l-blue-500 bg-blue-50/50',
};

const SEVERITY_BADGE: Record<string, 'danger' | 'warning' | 'info'> = {
  error: 'danger',
  warning: 'warning',
  info: 'info',
};

const CATEGORY_OPTIONS = [
  'entertainment', 'communication', 'productivity', 'custom',
];

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

export default function AlertsPage() {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<string | null>(null);
  const [liveDetections, setLiveDetections] = useState<AlertDetection[]>([]);
  const [editingRule, setEditingRule] = useState<WatchRule | null>(null);

  const [formData, setFormData] = useState({ name: '', pattern: '', category: 'custom', severity: 'warning', notifyAdmins: true });

  const { data: rulesData, isLoading: rulesLoading } = useQuery({
    queryKey: ['watch-rules'],
    queryFn: () => apiGet<WatchRule[]>('/watch-rules'),
    refetchInterval: 10000,
  });

  const { data: detectionsData, refetch: refetchDetections } = useQuery({
    queryKey: ['alert-detections'],
    queryFn: () => apiGet<DetectionsResponse>('/alerts/detections', { limit: 100 }),
    refetchInterval: 15000,
  });

  const rules = rulesData ?? [];
  const serverDetections = detectionsData?.detections ?? [];
  const allDetections = [...liveDetections, ...serverDetections.filter(
    (d) => !liveDetections.some((ld) => ld.id === d.id)
  )].slice(0, 100);

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiPost<WatchRule>('/watch-rules', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['watch-rules'] }); setShowAddModal(false); resetForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<WatchRule> }) => apiPut(`/watch-rules/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['watch-rules'] }); setShowEditModal(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/watch-rules/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watch-rules'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiPost<{ markedRead: number }>('/alerts/detections/read-all'),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['alert-detections'] }); },
  });

  function resetForm() {
    setFormData({ name: '', pattern: '', category: 'custom', severity: 'warning', notifyAdmins: true });
  }

  useEffect(() => {
    const socket = io('http://localhost:4000', { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('alert:app-detected', (data: AlertDetection & { timestamp: string }) => {
      const detection: AlertDetection = {
        ...data,
        id: data.id || `${Date.now()}`,
        notifiedAt: data.timestamp || new Date().toISOString(),
        read: false,
      };
      setLiveDetections((prev) => [detection, ...prev].slice(0, 100));
    });

    return () => { socket.disconnect(); };
  }, []);

  const openEditModal = (rule: WatchRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      pattern: rule.pattern,
      category: rule.category,
      severity: rule.severity,
      notifyAdmins: rule.notifyAdmins,
    });
    setShowEditModal(rule.id);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BellRing size={28} className="text-primary-500" />
            <div>
              <h1 className="text-2xl font-bold text-surface-900">App Alerts</h1>
              <p className="text-sm text-surface-500">
                Real-time monitoring of prohibited applications via ActivityWatch
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => refetchDetections()} size="sm">
              <RefreshCw size={16} /> Refresh
            </Button>
            <Button onClick={() => { resetForm(); setShowAddModal(true); }}>
              <Plus size={16} /> Add Rule
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Watch Rules */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b px-5 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-surface-700">
                <SlidersHorizontal size={16} /> Watch Rules ({rules.length})
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {rulesLoading ? (
                <div className="flex items-center justify-center py-8 text-surface-400">
                  <Loader2 size={20} className="animate-spin mr-2" /> Loading rules...
                </div>
              ) : rules.length === 0 ? (
                <div className="py-8 text-center text-sm text-surface-400">
                  No watch rules configured. Click "Add Rule" to create one.
                </div>
              ) : (
                <div className="space-y-2">
                  {rules.map((rule) => (
                    <div
                      key={rule.id}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-surface-50',
                        !rule.isActive && 'opacity-50'
                      )}
                    >
                      <div className={cn(
                        'rounded-full p-1.5',
                        rule.severity === 'error' ? 'bg-red-100 text-red-600' :
                        rule.severity === 'warning' ? 'bg-yellow-100 text-yellow-600' :
                        'bg-blue-100 text-blue-600'
                      )}>
                        {rule.severity === 'error' ? <AlertTriangle size={14} /> : <Activity size={14} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-surface-900">{rule.name}</span>
                          <Badge variant={SEVERITY_BADGE[rule.severity] ?? 'info'}>{rule.severity}</Badge>
                        </div>
                        <p className="text-xs text-surface-500 mt-0.5">
                          Pattern: "<span className="font-mono text-primary-600">{rule.pattern}</span>"
                          {rule.category !== 'custom' && <> · {rule.category}</>}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => updateMutation.mutate({ id: rule.id, data: { isActive: !rule.isActive } })}
                          className={cn(
                            'rounded-lg p-1.5 transition-colors',
                            rule.isActive ? 'text-green-600 hover:bg-green-50' : 'text-surface-300 hover:bg-surface-100'
                          )}
                          title={rule.isActive ? 'Disable' : 'Enable'}
                        >
                          {rule.isActive ? <Power size={16} /> : <PowerOff size={16} />}
                        </button>
                        <button
                          onClick={() => openEditModal(rule)}
                          className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-700"
                          title="Edit"
                        >
                          <SlidersHorizontal size={16} />
                        </button>
                        <button
                          onClick={() => { if (confirm('Delete this rule?')) deleteMutation.mutate(rule.id); }}
                          className="rounded-lg p-1.5 text-surface-400 hover:bg-red-50 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right: Live Detection Feed */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b px-5 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-surface-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
                Live Detections
                <span className="text-xs font-normal text-surface-400">
                  ({allDetections.length})
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => markAllReadMutation.mutate()}>
                  <CheckCheck size={14} /> Mark all read
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div ref={feedRef} className="max-h-[600px] overflow-y-auto">
                {allDetections.length === 0 ? (
                  <div className="px-4 py-12 text-center text-sm text-surface-400">
                    <Bell size={32} className="mx-auto mb-2 text-surface-300" />
                    No detections yet. Rules will monitor ActivityWatch every 30 seconds.
                  </div>
                ) : (
                  allDetections.map((d, i) => (
                    <div
                      key={d.id || i}
                      className={cn(
                        'border-l-4 border-b px-4 py-3 transition-colors hover:bg-surface-50',
                        SEVERITY_STYLES[d.severity] ?? 'border-l-surface-300'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Globe size={14} className="shrink-0 text-surface-400" />
                            <span className="truncate text-sm font-semibold text-surface-900">{d.appName}</span>
                            <Badge variant={SEVERITY_BADGE[d.severity] ?? 'info'}>{d.severity}</Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-surface-500">
                            Matched rule: <span className="font-medium text-primary-600">{d.ruleName}</span>
                            {d.hostname && <> · {d.hostname}</>}
                          </p>
                          <p className="mt-0.5 text-xs text-surface-400">{d.message}</p>
                        </div>
                        <span className="shrink-0 text-[11px] text-surface-400">{formatTime(d.notifiedAt)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Rule Modal */}
      {showAddModal && (
        <RuleModal
          title="Add Watch Rule"
          formData={formData}
          onChange={setFormData}
          onSave={() => createMutation.mutate(formData)}
          onClose={() => setShowAddModal(false)}
          loading={createMutation.isPending}
        />
      )}

      {/* Edit Rule Modal */}
      {showEditModal && editingRule && (
        <RuleModal
          title="Edit Watch Rule"
          formData={formData}
          onChange={setFormData}
          onSave={() => updateMutation.mutate({ id: editingRule.id, data: formData })}
          onClose={() => { setShowEditModal(null); setEditingRule(null); }}
          loading={updateMutation.isPending}
        />
      )}
    </DashboardLayout>
  );
}

function RuleModal({
  title, formData, onChange, onSave, onClose, loading,
}: {
  title: string;
  formData: { name: string; pattern: string; category: string; severity: string; notifyAdmins: boolean };
  onChange: (data: typeof formData) => void;
  onSave: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-surface-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-surface-100"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Rule Name</label>
            <input
              type="text" value={formData.name}
              onChange={(e) => onChange({ ...formData, name: e.target.value })}
              className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
              placeholder="e.g., Social Media"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">App Pattern</label>
            <input
              type="text" value={formData.pattern}
              onChange={(e) => onChange({ ...formData, pattern: e.target.value })}
              className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm outline-none focus:border-primary-500 font-mono"
              placeholder="e.g., gmail, youtube, facebook"
            />
            <p className="mt-1 text-xs text-surface-400">Matches if the running app name contains this text (case-insensitive)</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => onChange({ ...formData, category: e.target.value })}
                className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
              >
                {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">Severity</label>
              <select
                value={formData.severity}
                onChange={(e) => onChange({ ...formData, severity: e.target.value })}
                className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.notifyAdmins}
              onChange={(e) => onChange({ ...formData, notifyAdmins: e.target.checked })}
              className="rounded border-surface-300"
            />
            <span className="text-sm text-surface-700">Notify all admins</span>
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onSave} loading={loading}>Save Rule</Button>
        </div>
      </div>
    </div>
  );
}
