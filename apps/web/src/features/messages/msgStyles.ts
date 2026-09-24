import { usePresenceStore } from '@/stores/presenceStore'

/** 11px 0.04em eyebrow used for section labels throughout the Messages page. */
export const eyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.04em',
  color: 'var(--text-label)',
}

export function useIsOnline(userId: string | undefined): boolean {
  return usePresenceStore((s) => (userId ? s.byUser[userId]?.status === 'online' : false))
}
