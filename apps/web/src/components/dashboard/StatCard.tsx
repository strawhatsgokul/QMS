'use client';

import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  total?: number;
  icon: LucideIcon;
  variant: 'success' | 'info' | 'warning' | 'danger';
  onClick?: () => void;
}

const variantStyles = {
  success: 'bg-green-50 text-green-600',
  info: 'bg-blue-50 text-blue-600',
  warning: 'bg-yellow-50 text-yellow-600',
  danger: 'bg-red-50 text-red-600',
};

export function StatCard({ title, value, total, icon: Icon, variant, onClick }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-white p-5 shadow-sm transition-all hover:shadow-md',
        onClick && 'cursor-pointer'
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-surface-500">{title}</p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-2xl font-bold text-surface-900">{value}</p>
            {total !== undefined && (
              <span className="text-sm text-surface-400">/ {total}</span>
            )}
          </div>
        </div>
        <div className={cn('rounded-lg p-2.5', variantStyles[variant])}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}
