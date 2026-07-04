import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { socket } from '@/lib/socket'
import { useToastStore } from '@/stores/toastStore'

// ── Socket payload shape (snake_case, matches docs/socket-events.md#badge-earned) ──

interface EarnedBadge {
  id: string
  name: string
  description: string
  icon_url: string | null
  points: number
}

interface BadgeEarnedPayload {
  badge: EarnedBadge
}

export function useAchievementSocket() {
  const queryClient = useQueryClient()

  useEffect(() => {
    function onBadgeEarned({ badge }: BadgeEarnedPayload) {
      useToastStore.getState().show({
        message: `Badge earned: ${badge.name}`,
        type: 'success',
        durationMs: 6000,
      })
      queryClient.invalidateQueries({ queryKey: ['learning', 'badges'] })
    }

    socket.on('badge:earned', onBadgeEarned)

    return () => {
      socket.off('badge:earned', onBadgeEarned)
    }
  }, [queryClient])
}
