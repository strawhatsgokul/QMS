import { create } from 'zustand';
import type { DashboardStats, Computer, Alert } from '@veyon-aw/shared';

interface DashboardState {
  stats: DashboardStats | null;
  computers: Computer[];
  alerts: Alert[];
  selectedComputerId: string | null;
  loading: boolean;
  setStats: (stats: DashboardStats) => void;
  setComputers: (computers: Computer[]) => void;
  updateComputer: (computer: Partial<Computer> & { id: string }) => void;
  addAlert: (alert: Alert) => void;
  markAlertRead: (alertId: string) => void;
  setSelectedComputer: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useDashboardStore = create<DashboardState>()((set) => ({
  stats: null,
  computers: [],
  alerts: [],
  selectedComputerId: null,
  loading: false,

  setStats: (stats) => set({ stats }),

  setComputers: (computers) => set({ computers }),

  updateComputer: (updated) =>
    set((state) => ({
      computers: state.computers.map((c) =>
        c.id === updated.id ? { ...c, ...updated } : c,
      ),
    })),

  addAlert: (alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts].slice(0, 50),
    })),

  markAlertRead: (alertId) =>
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.id === alertId ? { ...a, read: true } : a,
      ),
    })),

  setSelectedComputer: (id) => set({ selectedComputerId: id }),

  setLoading: (loading) => set({ loading }),
}));
