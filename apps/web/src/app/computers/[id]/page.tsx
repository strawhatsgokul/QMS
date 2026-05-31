'use client';

import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import type { Computer, ActivityEvent } from '@veyon-aw/shared';
import { getStatusLabel, formatDate, formatDuration } from '@/lib/utils';
import {
  ArrowLeft,
  Monitor,
  Lock,
  Unlock,
  Power,
  RefreshCw,
  MessageSquare,
  FileUp,
  Play,
  Clock,
  User,
  Network,
  HardDrive,
  ExternalLink,
  Terminal,
} from 'lucide-react';
import { useState, useRef, useCallback } from 'react';
import { useAuthStore } from '@/store/auth';

export default function ComputerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);
  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'staff';
  const [messageText, setMessageText] = useState('');
  const [execCmd, setExecCmd] = useState('');
  const [showExecInput, setShowExecInput] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showFeedback = useCallback((type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  }, []);

  const { data: computer, refetch } = useQuery({
    queryKey: ['computer', params.id],
    queryFn: () => apiGet<Computer>(`/computers/${params.id}`),
    refetchInterval: 10000,
  });

  const lockMutation = useMutation({
    mutationFn: () => apiPost(`/veyon/screen/lock`, { computerIds: [params.id] }),
    onSuccess: () => { showFeedback('success', 'Computer locked'); refetch(); },
    onError: (e: Error) => showFeedback('error', `Lock failed: ${e.message}`),
  });

  const unlockMutation = useMutation({
    mutationFn: () => apiPost(`/veyon/screen/unlock`, { computerIds: [params.id] }),
    onSuccess: () => { showFeedback('success', 'Computer unlocked'); refetch(); },
    onError: (e: Error) => showFeedback('error', `Unlock failed: ${e.message}`),
  });

  const restartMutation = useMutation({
    mutationFn: () => apiPost(`/veyon/power/restart`, { computerIds: [params.id] }),
    onSuccess: () => showFeedback('success', 'Restart command sent'),
    onError: (e: Error) => showFeedback('error', `Restart failed: ${e.message}`),
  });

  const shutdownMutation = useMutation({
    mutationFn: () => apiPost(`/veyon/power/shutdown`, { computerIds: [params.id] }),
    onSuccess: () => showFeedback('success', 'Shutdown command sent'),
    onError: (e: Error) => showFeedback('error', `Shutdown failed: ${e.message}`),
  });

  const messageMutation = useMutation({
    mutationFn: () => apiPost(`/veyon/message`, { computerIds: [params.id], message: messageText }),
    onSuccess: () => { showFeedback('success', 'Message sent'); setMessageText(''); },
    onError: (e: Error) => showFeedback('error', `Message failed: ${e.message}`),
  });

  const fileCopyMutation = useMutation({
    mutationFn: ({ sourcePath, destinationPath }: { sourcePath: string; destinationPath: string }) =>
      apiPost('/veyon/file/copy', { computerIds: [params.id], sourcePath, destinationPath }),
    onSuccess: () => showFeedback('success', 'File copied'),
    onError: (e: Error) => showFeedback('error', `File copy failed: ${e.message}`),
  });

  const statusScan = useMutation({
    mutationFn: () => apiPost<{ online: boolean }>(`/computers/${params.id}/scan`),
    onSuccess: (data) => { if (!data.online) refetch(); },
  });

  const screenshotQuery = useQuery({
    queryKey: ['screenshot', params.id],
    queryFn: () => apiGet<{ thumbnail: string }>(`/veyon/screen/${params.id}`),
    enabled: !!computer && computer.status === 'online',
    refetchInterval: 30000,
    retry: 2,
  });

  const activityQuery = useQuery({
    queryKey: ['activity-events', params.id],
    queryFn: () => apiGet<ActivityEvent[]>('/activity/events', { period: 'day' }),
    enabled: !!computer,
  });

  const handleFileCopy = () => {
    const sourcePath = window.prompt('Enter the source file path on the target computer:');
    if (!sourcePath) return;
    const destPath = window.prompt('Enter the destination file path:');
    if (!destPath) return;
    fileCopyMutation.mutate({ sourcePath: sourcePath.trim(), destinationPath: destPath.trim() });
  };

  const handleExecute = () => {
    if (showExecInput) {
      if (execCmd.trim()) {
        messageMutation.mutate();
        setExecCmd('');
        setShowExecInput(false);
      }
    } else {
      setShowExecInput(true);
    }
  };

  const handleRemoteView = () => {
    const vncUrl = computer?.ipAddress ? `vnc://${computer.ipAddress}:5900` : `vnc://127.0.0.1:5900`;
    window.open(vncUrl, '_blank', 'noopener');
  };

  if (!computer) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <p className="text-surface-400">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  const timelineEvents = (activityQuery.data ?? []).slice(0, 10);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-surface-500 hover:text-surface-700"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-surface-900">{computer.hostname}</h1>
              <Badge variant={
                computer.status === 'online' ? 'success' :
                computer.status === 'locked' ? 'warning' :
                computer.status === 'sleeping' ? 'info' : 'default'
              }>
                {getStatusLabel(computer.status)}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-surface-500">{computer.ipAddress}</p>
          </div>

          <div className="flex items-center gap-2">
            {feedback && (
              <span className={`text-sm font-medium ${feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {feedback.msg}
              </span>
            )}
            {canManage && (
              <div className="flex gap-2">
                {computer.status === 'locked' ? (
                  <Button onClick={() => unlockMutation.mutate()} loading={unlockMutation.isPending}>
                    <Unlock size={16} /> Unlock
                  </Button>
                ) : (
                  <Button onClick={() => lockMutation.mutate()} loading={lockMutation.isPending}>
                    <Lock size={16} /> Lock
                  </Button>
                )}
                <Button variant="outline" onClick={() => restartMutation.mutate()} loading={restartMutation.isPending}>
                  <RefreshCw size={16} /> Restart
                </Button>
                <Button variant="outline" onClick={() => {
                  if (window.confirm(`Shut down ${computer.hostname}?`)) shutdownMutation.mutate();
                }} loading={shutdownMutation.isPending}>
                  <Power size={16} /> Shutdown
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Screen Preview</h2>
              </CardHeader>
              <CardContent>
                {computer.status === 'online' ? (
                  <div className="aspect-video rounded-lg bg-surface-100 flex items-center justify-center">
                    {screenshotQuery.isError ? (
                      <div className="text-center text-red-400">
                        <Monitor size={48} className="mx-auto mb-2" />
                        <p>Preview unavailable</p>
                        <p className="mt-1 text-xs">{(screenshotQuery.error as Error)?.message || 'Host unreachable'}</p>
                      </div>
                    ) : screenshotQuery.data ? (
                      <img
                        src={`data:image/png;base64,${screenshotQuery.data.thumbnail}`}
                        alt={`${computer.hostname} screen`}
                        className="h-full w-full rounded-lg object-contain"
                      />
                    ) : (
                      <div className="text-center text-surface-400">
                        <Monitor size={48} className="mx-auto mb-2" />
                        <p>Loading preview...</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="aspect-video rounded-lg bg-surface-100 flex items-center justify-center">
                    <div className="text-center text-surface-400">
                      <Monitor size={48} className="mx-auto mb-2" />
                      <p>Computer is {computer.status}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {canManage && (
              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold">Quick Actions</h2>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <button onClick={handleExecute} className="flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors hover:bg-surface-50">
                      <Terminal size={24} className="text-primary-500" />
                      <span className="text-xs font-medium">Execute</span>
                    </button>
                    <button onClick={handleFileCopy} className="flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors hover:bg-surface-50">
                      <FileUp size={24} className="text-primary-500" />
                      <span className="text-xs font-medium">Send File</span>
                    </button>
                    <button onClick={() => document.getElementById('message-input')?.focus()} className="flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors hover:bg-surface-50">
                      <MessageSquare size={24} className="text-primary-500" />
                      <span className="text-xs font-medium">Send Message</span>
                    </button>
                    <button onClick={handleRemoteView} className="flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors hover:bg-surface-50">
                      <ExternalLink size={24} className="text-primary-500" />
                      <span className="text-xs font-medium">Remote View</span>
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {showExecInput && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Command to execute..."
                          value={execCmd}
                          onChange={(e) => setExecCmd(e.target.value)}
                          className="flex-1 rounded-lg border border-surface-300 px-4 py-2 text-sm outline-none focus:border-primary-500"
                        />
                        <Button onClick={() => {
                          if (execCmd.trim()) messageMutation.mutate();
                          setShowExecInput(false);
                          setExecCmd('');
                        }}>Run</Button>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        id="message-input"
                        type="text"
                        placeholder="Message to send..."
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        className="flex-1 rounded-lg border border-surface-300 px-4 py-2 text-sm outline-none focus:border-primary-500"
                      />
                      <Button onClick={() => messageMutation.mutate()} loading={messageMutation.isPending}>
                        Send
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Details</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Network size={18} className="text-surface-400" />
                  <div>
                    <p className="text-xs text-surface-500">IP Address</p>
                    <p className="text-sm font-medium">{computer.ipAddress}</p>
                  </div>
                </div>
                {computer.macAddress && (
                  <div className="flex items-center gap-3">
                    <HardDrive size={18} className="text-surface-400" />
                    <div>
                      <p className="text-xs text-surface-500">MAC Address</p>
                      <p className="text-sm font-medium">{computer.macAddress}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <User size={18} className="text-surface-400" />
                  <div>
                    <p className="text-xs text-surface-500">Current User</p>
                    <p className="text-sm font-medium">{computer.currentUser || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock size={18} className="text-surface-400" />
                  <div>
                    <p className="text-xs text-surface-500">Last Seen</p>
                    <p className="text-sm font-medium">
                      {computer.lastSeen ? formatDate(computer.lastSeen) : 'N/A'}
                    </p>
                  </div>
                </div>
                {computer.os && (
                  <div className="flex items-center gap-3">
                    <HardDrive size={18} className="text-surface-400" />
                    <div>
                      <p className="text-xs text-surface-500">OS</p>
                      <p className="text-sm font-medium">{computer.os}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Activity Timeline</h2>
              </CardHeader>
              <CardContent>
                {activityQuery.isLoading ? (
                  <p className="text-sm text-surface-400">Loading events...</p>
                ) : timelineEvents.length > 0 ? (
                  <div className="space-y-3">
                    {timelineEvents.map((event, i) => (
                      <div key={event.id ?? i} className="border-l-2 border-surface-200 pl-4">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-primary-500" />
                          <p className="text-xs text-surface-500">
                            {event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : 'N/A'}
                            {event.duration ? ` · ${formatDuration(Math.round(event.duration / 60))}` : ''}
                          </p>
                        </div>
                        <p className="mt-1 text-sm text-surface-700">
                          {(event.data as any)?.app || 'Unknown'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-surface-400">No recent activity events</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
