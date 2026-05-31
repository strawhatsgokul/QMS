'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    const body = {
      message: error.message,
      stack: error.stack,
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    };
    fetch('/api/logs/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-50">
      <div className="text-center">
        <AlertTriangle size={64} className="mx-auto mb-4 text-red-400" />
        <h1 className="text-2xl font-bold text-surface-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-surface-500">{error.message || 'An unexpected error occurred'}</p>
        <Button onClick={reset} className="mt-6">
          <RefreshCw size={16} /> Try Again
        </Button>
      </div>
    </div>
  );
}
