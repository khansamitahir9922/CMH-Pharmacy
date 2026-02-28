import { create } from 'zustand'

export interface InventorySummaryCounts {
  totalMedicines: number
  lowStock: number
  expiringThisMonth: number
  expired: number
}

interface AlertState {
  /** Summary counts from inventory:getSummary (refreshed on login and every 5 min) */
  summary: InventorySummaryCounts
  setSummary: (summary: InventorySummaryCounts) => void

  /** Dismissed alert banners for this session (key: 'expired' | 'expiring30' | 'lowStock') */
  dismissedBanners: Set<string>
  dismissBanner: (key: string) => void
  resetDismissed: () => void
}

export const useAlertStore = create<AlertState>((set) => ({
  summary: {
    totalMedicines: 0,
    lowStock: 0,
    expiringThisMonth: 0,
    expired: 0
  },
  setSummary: (summary) => set({ summary }),

  dismissedBanners: new Set(),
  dismissBanner: (key) =>
    set((state) => {
      const next = new Set(state.dismissedBanners)
      next.add(key)
      return { dismissedBanners: next }
    }),
  resetDismissed: () => set({ dismissedBanners: new Set() })
}))
