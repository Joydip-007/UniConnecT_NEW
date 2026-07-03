import { create } from 'zustand'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
  onUndo?: () => void
}

interface ToastState {
  toasts: Toast[]
  show: (opts: { message: string; type?: Toast['type']; onUndo?: () => void; durationMs?: number }) => string
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: ({ message, type = 'success', onUndo, durationMs }) => {
    const id = crypto.randomUUID()
    // Undo toasts stay longer so the user has time to react.
    const ttl = durationMs ?? (onUndo ? 6000 : 3500)
    set((s) => ({ toasts: [...s.toasts, { id, message, type, onUndo }] }))
    setTimeout(() => get().dismiss(id), ttl)
    return id
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
