import { create } from 'zustand';

interface UIState {
  isBellOpen: boolean;
  setBellOpen: (open: boolean) => void;
  toggleBell: () => void;
}

export const useUIStore = create<UIState>()((set) => ({
  isBellOpen: false,
  setBellOpen: (open) => set({ isBellOpen: open }),
  toggleBell: () => set((state) => ({ isBellOpen: !state.isBellOpen })),
}));
