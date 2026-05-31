'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import type { Computer, Room } from '@veyon-aw/shared';
import { getStatusLabel } from '@/lib/utils';
import { Monitor, Lock, Power, MessageSquare, Search, Unlock, Plus, X, Trash2 } from 'lucide-react';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';

export default function ComputersPage() {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);
  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'staff';
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedComputers, setSelectedComputers] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showFeedback = useCallback((type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  }, []);

  const { data: computers, refetch } = useQuery({
    queryKey: ['computers'],
    queryFn: () => apiGet<Computer[]>('/computers'),
    refetchInterval: 15000,
  });

  const { data: rooms } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => apiGet<Room[]>('/rooms'),
  });

  const lockMutation = useMutation({
    mutationFn: (ids: string[]) => apiPost('/veyon/screen/lock', { computerIds: ids }),
    onSuccess: () => { showFeedback('success', 'Computers locked'); refetch(); },
    onError: (e: Error) => showFeedback('error', `Lock failed: ${e.message}`),
  });

  const unlockMutation = useMutation({
    mutationFn: (ids: string[]) => apiPost('/veyon/screen/unlock', { computerIds: ids }),
    onSuccess: () => { showFeedback('success', 'Computers unlocked'); refetch(); },
    onError: (e: Error) => showFeedback('error', `Unlock failed: ${e.message}`),
  });

  const restartMutation = useMutation({
    mutationFn: (ids: string[]) => apiPost('/veyon/power/restart', { computerIds: ids }),
    onSuccess: () => showFeedback('success', 'Restart command sent'),
    onError: (e: Error) => showFeedback('error', `Restart failed: ${e.message}`),
  });

  const messageMutation = useMutation({
    mutationFn: ({ ids, msg }: { ids: string[]; msg: string }) =>
      apiPost('/veyon/message', { computerIds: ids, message: msg }),
    onSuccess: () => showFeedback('success', 'Message sent'),
    onError: (e: Error) => showFeedback('error', `Message failed: ${e.message}`),
  });

  const filteredComputers = (computers ?? []).filter((c) => {
    const matchesRoom = !selectedRoom || c.roomId === selectedRoom;
    const matchesSearch = !searchQuery ||
      c.hostname.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.ipAddress.includes(searchQuery);
    return matchesRoom && matchesSearch;
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [newComputer, setNewComputer] = useState({ hostname: '', ipAddress: '', macAddress: '', roomId: '' });

  const createMutation = useMutation({
    mutationFn: (data: typeof newComputer) =>
      apiPost('/computers', { ...data, roomId: data.roomId || undefined, macAddress: data.macAddress || undefined }),
    onSuccess: () => { showFeedback('success', 'Computer added'); setShowAddModal(false); setNewComputer({ hostname: '', ipAddress: '', macAddress: '', roomId: '' }); refetch(); },
    onError: (e: Error) => showFeedback('error', `Failed to add: ${e.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/computers/${id}`),
    onSuccess: () => { showFeedback('success', 'Computer deleted'); refetch(); },
    onError: (e: Error) => showFeedback('error', `Delete failed: ${e.message}`),
  });

  const toggleSelect = (id: string) => {
    setSelectedComputers((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleBulkRestart = () => {
    if (window.confirm(`Restart all ${selectedComputers.length} selected computers?`)) {
      restartMutation.mutate(selectedComputers);
    }
  };

  const handleBulkMessage = () => {
    const msg = window.prompt('Enter message to send to selected computers:');
    if (msg && msg.trim()) {
      messageMutation.mutate({ ids: selectedComputers, msg: msg.trim() });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-surface-900">Computers</h1>
            <p className="mt-1 text-sm text-surface-500">
              Manage and monitor all computers
            </p>
          </div>
          <div className="flex items-center gap-2">
            {feedback && (
              <span className={`text-sm font-medium ${feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {feedback.msg}
              </span>
            )}
            {selectedComputers.length > 0 && canManage && (
              <>
                <Button variant="outline" size="sm" onClick={() => lockMutation.mutate(selectedComputers)} loading={lockMutation.isPending}>
                  <Lock size={16} /> Lock ({selectedComputers.length})
                </Button>
                <Button variant="outline" size="sm" onClick={() => unlockMutation.mutate(selectedComputers)} loading={unlockMutation.isPending}>
                  <Unlock size={16} /> Unlock
                </Button>
                <Button variant="outline" size="sm" onClick={handleBulkRestart} loading={restartMutation.isPending}>
                  <Power size={16} /> Restart
                </Button>
                <Button variant="outline" size="sm" onClick={handleBulkMessage} loading={messageMutation.isPending}>
                  <MessageSquare size={16} /> Message
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" size={18} />
            <input
              type="text"
              placeholder="Search computers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-surface-200 bg-white py-2 pl-10 pr-4 text-sm outline-none focus:border-primary-500"
            />
          </div>
          <select
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
            className="rounded-lg border border-surface-200 bg-white px-4 py-2 text-sm outline-none focus:border-primary-500"
          >
            <option value="">All Rooms</option>
            {(rooms ?? []).map((room) => (
              <option key={room.id} value={room.id}>{room.name}</option>
            ))}
          </select>
          {canManage && (
            <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
              <Plus size={16} /> Add Computer
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-surface-50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-500">
                      <input
                        type="checkbox"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedComputers(filteredComputers.map((c) => c.id));
                          } else {
                            setSelectedComputers([]);
                          }
                        }}
                        checked={selectedComputers.length === filteredComputers.length && filteredComputers.length > 0}
                        className="rounded border-surface-300"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-500">Hostname</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-500">IP Address</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-500">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-500">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-500">Room</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredComputers.map((computer) => (
                    <tr key={computer.id} className="border-b transition-colors hover:bg-surface-50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedComputers.includes(computer.id)}
                          onChange={() => toggleSelect(computer.id)}
                          className="rounded border-surface-300"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => router.push(`/computers/${computer.id}`)} className="font-medium text-surface-900 hover:text-primary-600">
                          {computer.hostname}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-surface-500">{computer.ipAddress}</td>
                      <td className="px-4 py-3">
                        <Badge variant={
                          computer.status === 'online' ? 'success' :
                          computer.status === 'locked' ? 'warning' :
                          computer.status === 'sleeping' ? 'info' : 'default'
                        }>
                          {getStatusLabel(computer.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-surface-500">
                        {computer.currentUser || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-surface-500">
                        {computer.room?.name || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => router.push(`/computers/${computer.id}`)} title="View screen">
                            <Monitor size={16} />
                          </Button>
                          {canManage && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => lockMutation.mutate([computer.id])} title="Lock" loading={lockMutation.isPending}>
                                <Lock size={16} />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => {
                                if (window.confirm(`Restart ${computer.hostname}?`)) restartMutation.mutate([computer.id]);
                              }} title="Restart" loading={restartMutation.isPending}>
                                <Power size={16} />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => {
                                if (window.confirm(`Delete ${computer.hostname}?`)) deleteMutation.mutate(computer.id);
                              }} title="Delete" className="text-red-400 hover:text-red-600">
                                <Trash2 size={16} />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredComputers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-surface-400">
                        No computers found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAddModal(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-surface-900">Add Computer</h2>
              <button onClick={() => setShowAddModal(false)} className="text-surface-400 hover:text-surface-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-700">Hostname</label>
                <input type="text" value={newComputer.hostname} onChange={(e) => setNewComputer({ ...newComputer, hostname: e.target.value })}
                  className="w-full rounded-lg border border-surface-300 px-4 py-2 text-sm outline-none focus:border-primary-500" placeholder="e.g. PC-001" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-700">IP Address</label>
                <input type="text" value={newComputer.ipAddress} onChange={(e) => setNewComputer({ ...newComputer, ipAddress: e.target.value })}
                  className="w-full rounded-lg border border-surface-300 px-4 py-2 text-sm outline-none focus:border-primary-500" placeholder="e.g. 192.168.1.101" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-700">MAC Address <span className="text-surface-400">(optional)</span></label>
                <input type="text" value={newComputer.macAddress} onChange={(e) => setNewComputer({ ...newComputer, macAddress: e.target.value })}
                  className="w-full rounded-lg border border-surface-300 px-4 py-2 text-sm outline-none focus:border-primary-500" placeholder="e.g. AA:BB:CC:DD:EE:FF" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-700">Room <span className="text-surface-400">(optional)</span></label>
                <select value={newComputer.roomId} onChange={(e) => setNewComputer({ ...newComputer, roomId: e.target.value })}
                  className="w-full rounded-lg border border-surface-300 px-4 py-2 text-sm outline-none focus:border-primary-500">
                  <option value="">No room</option>
                  {(rooms ?? []).map((room) => (<option key={room.id} value={room.id}>{room.name}</option>))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button onClick={() => createMutation.mutate(newComputer)} loading={createMutation.isPending} disabled={!newComputer.hostname || !newComputer.ipAddress}>
                  Add Computer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
