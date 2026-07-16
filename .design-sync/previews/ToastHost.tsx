import { ToastHost } from 'web';

// ToastHost renders toasts from useToastStore (Zustand). The store isn't
// exported from the `web` package surface (only components are), so this
// preview can't seed toasts from outside. With zero toasts, ToastHost
// correctly renders an empty `aria-live="polite"` fixed-position region —
// that IS its correct default/idle appearance (no toast is currently queued).
export function Default() {
  return (
    <div
      style={{
        padding: 24,
        minHeight: 160,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        color: 'var(--text-secondary)',
        fontSize: 13,
      }}
    >
      ToastHost is mounted here (idle — 0 toasts queued, so the aria-live
      region is empty, which is correct default behavior).
      <ToastHost />
    </div>
  );
}
