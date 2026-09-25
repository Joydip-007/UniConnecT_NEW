import { create } from 'zustand'
import type { BroadcastStatus, DriverFix } from '@/features/shuttle/hooks/useDriverBroadcast'

/**
 * The driver's broadcast outlives the tab it was started on: the GPS watch runs in
 * `DriverBroadcastHost` (mounted once in the shell) and reads this store, so switching
 * between Drive, Duty board, News and Messages never drops the bus off the map.
 */
interface DriverBroadcastState {
  routeId: string | null
  active: boolean
  status: BroadcastStatus
  lastFix: DriverFix | null
  setRoute: (routeId: string | null) => void
  start: (routeId: string) => void
  stop: () => void
  report: (status: BroadcastStatus, lastFix: DriverFix | null) => void
}

export const useDriverBroadcastStore = create<DriverBroadcastState>((set) => ({
  routeId: null,
  active: false,
  status: 'idle',
  lastFix: null,
  setRoute: (routeId) => set({ routeId }),
  start: (routeId) => set({ routeId, active: true }),
  stop: () => set({ active: false, lastFix: null, status: 'idle' }),
  report: (status, lastFix) => set({ status, lastFix }),
}))
