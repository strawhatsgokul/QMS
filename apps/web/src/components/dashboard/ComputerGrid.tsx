'use client';

import type { Computer } from '@veyon-aw/shared';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { getStatusColor, getStatusLabel } from '@/lib/utils';
import { Monitor, Lock, Power, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';

interface ComputerGridProps {
  computers: Computer[];
}

export function ComputerGrid({ computers }: ComputerGridProps) {
  const router = useRouter();
  const onlineCount = computers.filter((c) => c.status === 'online').length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Computers</h2>
          <p className="text-sm text-surface-500" aria-live="polite">
            {onlineCount} of {computers.length} online
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" role="list" aria-label="Computer grid">
          {computers.map((computer) => (
            <div
              key={computer.id}
              onClick={() => router.push(`/computers/${computer.id}`)}
              className="card-hover cursor-pointer rounded-lg border p-3 transition-all"
              role="listitem"
              tabIndex={0}
              aria-label={`${computer.hostname} - ${getStatusLabel(computer.status)}`}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/computers/${computer.id}`); } }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={getStatusColor(computer.status)} aria-hidden="true" />
                  <Badge variant={
                    computer.status === 'online' ? 'success' :
                    computer.status === 'locked' ? 'warning' :
                    computer.status === 'sleeping' ? 'info' : 'default'
                  }>
                    {getStatusLabel(computer.status)}
                  </Badge>
                </div>
              </div>
              <p className="mt-2 font-medium text-surface-900">{computer.hostname}</p>
              <p className="text-xs text-surface-500">{computer.ipAddress}</p>
              {computer.currentUser && (
                <p className="mt-1 text-xs text-surface-400">
                  {computer.currentUser}
                </p>
              )}
            </div>
          ))}
        </div>

        {computers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-surface-400" role="status">
            <Monitor size={48} className="mb-3" aria-hidden="true" />
            <p className="font-medium">No computers found</p>
            <p className="text-sm">Add computers in settings to get started</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
