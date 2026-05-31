'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useState, useEffect, useCallback } from 'react';
import { Save, Eye, EyeOff, Info, AlertTriangle } from 'lucide-react';
import { apiGet, apiPut } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

interface SettingsData {
  veyon_cli_path?: string;
  veyon_connection_timeout?: number;
  activitywatch_api_url?: string;
  activitywatch_poll_interval?: number;
  notifications_computer_offline?: boolean;
  notifications_screen_lock?: boolean;
  notifications_activity_anomalies?: boolean;
  notifications_system_health?: boolean;
  notifications_user_login?: boolean;
  session_timeout_minutes?: number;
  max_login_attempts?: number;
  require_https?: boolean;
  audit_logging?: boolean;
}

const DEFAULTS: SettingsData = {
  veyon_cli_path: 'veyon-cli',
  veyon_connection_timeout: 10000,
  activitywatch_api_url: 'http://localhost:5600/api',
  activitywatch_poll_interval: 60,
  notifications_computer_offline: true,
  notifications_screen_lock: true,
  notifications_activity_anomalies: false,
  notifications_system_health: true,
  notifications_user_login: false,
  session_timeout_minutes: 120,
  max_login_attempts: 5,
  require_https: true,
  audit_logging: true,
};

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const [showKeys, setShowKeys] = useState(false);
  const [settings, setSettings] = useState<SettingsData>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    apiGet<SettingsData>('/settings')
      .then((data) => {
        const merged: SettingsData = { ...DEFAULTS };
        for (const key of Object.keys(DEFAULTS) as (keyof SettingsData)[]) {
          if (data[key] !== undefined && data[key] !== null) {
            (merged as Record<string, unknown>)[key] = data[key];
          }
        }
        setSettings(merged);
      })
      .catch(() => setSettings(DEFAULTS))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  const update = useCallback((key: keyof SettingsData, value: string | number | boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      await apiPut('/settings', settings);
      setFeedback({ type: 'success', msg: 'Settings saved successfully' });
      setTimeout(() => setFeedback(null), 4000);
    } catch (e) {
      setFeedback({ type: 'error', msg: `Failed to save: ${(e as Error).message}` });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <p className="text-surface-400">Loading settings...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <AlertTriangle size={48} className="mb-4 text-red-400" />
          <h2 className="text-xl font-semibold text-surface-900">Access Denied</h2>
          <p className="mt-1 text-sm text-surface-500">Only administrators can access the Settings page.</p>
        </div>
      </DashboardLayout>
    );
  }

  const notificationItems: { key: keyof SettingsData; label: string }[] = [
    { key: 'notifications_computer_offline', label: 'Computer offline alerts' },
    { key: 'notifications_screen_lock', label: 'Screen lock/unlock events' },
    { key: 'notifications_activity_anomalies', label: 'Activity anomalies' },
    { key: 'notifications_system_health', label: 'System health notifications' },
    { key: 'notifications_user_login', label: 'User login alerts' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-surface-900">Settings</h1>
            <p className="mt-1 text-sm text-surface-500">Configure system integrations and preferences</p>
          </div>
          {feedback && (
            <span className={`text-sm font-medium ${feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {feedback.msg}
            </span>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Veyon Integration</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">CLI Path</label>
                <input
                  type="text"
                  value={settings.veyon_cli_path ?? ''}
                  onChange={(e) => update('veyon_cli_path', e.target.value)}
                  className="w-full rounded-lg border border-surface-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500"
                />
                <p className="mt-1 text-xs text-surface-400">Path to the Veyon CLI executable</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">API Key</label>
                <div className="relative">
                  <input
                    type={showKeys ? 'text' : 'password'}
                    value=""
                    disabled
                    className="w-full rounded-lg border border-surface-200 bg-surface-50 px-4 py-2.5 text-sm text-surface-400 outline-none cursor-not-allowed"
                  />
                  <button
                    onClick={() => setShowKeys(!showKeys)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-300"
                  >
                    {showKeys ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className="mt-1.5 flex items-start gap-1.5">
                  <Info size={14} className="mt-0.5 shrink-0 text-surface-400" />
                  <p className="text-xs text-surface-400 leading-relaxed">
                    Disabled — reserved for future <strong>Client Agent</strong>.
                  </p>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Connection Timeout (ms)</label>
                <input
                  type="number"
                  value={settings.veyon_connection_timeout ?? 10000}
                  onChange={(e) => update('veyon_connection_timeout', parseInt(e.target.value, 10) || 10000)}
                  className="w-full rounded-lg border border-surface-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">ActivityWatch Integration</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">API URL</label>
                <input
                  type="text"
                  value={settings.activitywatch_api_url ?? ''}
                  onChange={(e) => update('activitywatch_api_url', e.target.value)}
                  className="w-full rounded-lg border border-surface-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">API Key</label>
                <div className="relative">
                  <input
                    type={showKeys ? 'text' : 'password'}
                    disabled
                    className="w-full rounded-lg border border-surface-200 bg-surface-50 px-4 py-2.5 text-sm text-surface-400 outline-none cursor-not-allowed"
                  />
                  <button
                    onClick={() => setShowKeys(!showKeys)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-300"
                  >
                    {showKeys ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className="mt-1.5 flex items-start gap-1.5">
                  <Info size={14} className="mt-0.5 shrink-0 text-surface-400" />
                  <p className="text-xs text-surface-400 leading-relaxed">
                    Disabled — reserved for future <strong>Client Agent</strong>.
                  </p>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Poll Interval (seconds)</label>
                <input
                  type="number"
                  value={settings.activitywatch_poll_interval ?? 60}
                  onChange={(e) => update('activitywatch_poll_interval', parseInt(e.target.value, 10) || 60)}
                  className="w-full rounded-lg border border-surface-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Notification Preferences</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              {notificationItems.map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <span className="text-sm text-surface-700">{item.label}</span>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={!!settings[item.key]}
                      onChange={(e) => update(item.key, e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="h-6 w-11 rounded-full bg-surface-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-primary-600 peer-checked:after:translate-x-full" />
                  </label>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Security</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Session Timeout (minutes)</label>
                <input
                  type="number"
                  value={settings.session_timeout_minutes ?? 120}
                  onChange={(e) => update('session_timeout_minutes', parseInt(e.target.value, 10) || 120)}
                  className="w-full rounded-lg border border-surface-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Max Login Attempts</label>
                <input
                  type="number"
                  value={settings.max_login_attempts ?? 5}
                  onChange={(e) => update('max_login_attempts', parseInt(e.target.value, 10) || 5)}
                  className="w-full rounded-lg border border-surface-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-surface-700">Require HTTPS</span>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={!!settings.require_https}
                    onChange={(e) => update('require_https', e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="h-6 w-11 rounded-full bg-surface-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-primary-600 peer-checked:after:translate-x-full" />
                </label>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-surface-700">Audit Logging</span>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={!!settings.audit_logging}
                    onChange={(e) => update('audit_logging', e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="h-6 w-11 rounded-full bg-surface-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-primary-600 peer-checked:after:translate-x-full" />
                </label>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} loading={saving}>
            <Save size={16} /> Save Settings
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
