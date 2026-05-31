'use client';

import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';
import { useRouter } from 'next/navigation';
import { Bell, Search, CheckCheck, User, Settings, LogOut, ChevronDown, Circle } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut, apiPost } from '@/lib/api';
import { cn } from '@/lib/utils';

interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  source: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function typeIcon(type: string) {
  switch (type) {
    case 'error': return 'text-red-500';
    case 'warning': return 'text-yellow-500';
    case 'success': return 'text-green-500';
    default: return 'text-blue-500';
  }
}

export function Header() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const queryClient = useQueryClient();
  const isBellOpen = useUIStore((s) => s.isBellOpen);
  const setBellOpen = useUIStore((s) => s.setBellOpen);
  const toggleBell = useUIStore((s) => s.toggleBell);

  const [searchQuery, setSearchQuery] = useState('');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const bellRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiGet<NotificationsResponse>('/notifications', { limit: 20 }),
    refetchInterval: 30000,
  });

  const notifications = notifData?.notifications ?? [];
  const unreadCount = notifData?.unreadCount ?? 0;

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiPut(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiPost<{ markedRead: number }>('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setBellOpen]);

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <div className="relative w-96">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" size={18} />
        <input
          type="text"
          placeholder="Search computers, users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-surface-200 bg-surface-50 py-2 pl-10 pr-4 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
        />
      </div>

      <div className="flex items-center gap-2">
        {/* Notification Bell */}
        <div ref={bellRef} className="relative">
          <button
            onClick={toggleBell}
            className="relative rounded-lg p-2 hover:bg-surface-100"
          >
            <Bell size={20} className="text-surface-500" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {isBellOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-96 rounded-xl border bg-white shadow-xl">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h3 className="font-semibold text-surface-900">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllReadMutation.mutate()}
                    className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
                  >
                    <CheckCheck size={14} /> Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-surface-400">No notifications</div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        if (!n.read) markReadMutation.mutate(n.id);
                      }}
                      className={cn(
                        'flex w-full gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-surface-50',
                        !n.read && 'bg-primary-50/30'
                      )}
                    >
                      <div className="mt-0.5 shrink-0">
                        <Circle size={10} className={cn('fill-current', typeIcon(n.type))} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className={cn('text-sm', !n.read ? 'font-semibold text-surface-900' : 'text-surface-700')}>
                            {n.title}
                          </p>
                          <span className="shrink-0 text-[11px] text-surface-400">{formatTime(n.createdAt)}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-surface-500 line-clamp-2">{n.message}</p>
                      </div>
                      {!n.read && (
                        <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-500" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div ref={userMenuRef} className="relative">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-100"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
              {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium text-surface-900">{user?.name ?? 'User'}</p>
              <p className="text-xs text-surface-500 capitalize">{user?.role ?? 'viewer'}</p>
            </div>
            <ChevronDown size={16} className="hidden text-surface-400 sm:block" />
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border bg-white py-1 shadow-xl">
              <div className="border-b px-4 py-3">
                <p className="text-sm font-medium text-surface-900">{user?.name ?? 'User'}</p>
                <p className="text-xs text-surface-500">{user?.email ?? ''}</p>
              </div>

              <button
                onClick={() => { router.push('/settings'); setIsUserMenuOpen(false); }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50"
              >
                <Settings size={16} className="text-surface-400" /> Settings
              </button>

              <div className="border-t">
                <button
                  onClick={() => { logout(); router.push('/login'); }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut size={16} /> Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
