import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Circle, Lock, type LucideIcon } from 'lucide-react'
import { api } from '@/lib/axios'
import { DUR, EASE_OUT_EXPO, listItem } from '@/lib/motion'
import { RailSlot, SectionHeader, SkeletonLine } from './primitives'

interface UserProgress {
  profileScore: number
  hasMadePost: boolean
  connectionCount: number
  isVerified: boolean
}

interface BadgeProgressItem {
  icon: LucideIcon
  label: string
  state: 'done' | 'in-progress' | 'locked'
  progress?: number
  total?: number
}

function BadgeProgressRow({ item }: { item: BadgeProgressItem }) {
  const Icon = item.icon
  const iconColor =
    item.state === 'done'
      ? 'var(--uc-mint)'
      : item.state === 'locked'
      ? 'var(--text-tertiary)'
      : 'var(--uc-orange-l)'

  return (
    <div style={{ padding: '8px 0', borderBottom: '0.5px solid var(--border-default)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: item.state === 'in-progress' ? 6 : 0,
        }}
      >
        <Icon size={14} style={{ color: iconColor, flexShrink: 0 }} />
        <span
          style={{
            flex: 1,
            fontSize: 12,
            fontWeight: 500,
            color: item.state === 'locked' ? 'var(--text-tertiary)' : 'var(--text-primary)',
          }}
        >
          {item.label}
        </span>
        {item.state === 'in-progress' && item.progress != null && item.total != null && (
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {item.progress}/{item.total}
          </span>
        )}
        {item.state === 'done' && <span style={{ fontSize: 12, color: 'var(--uc-mint)' }}>Done</span>}
      </div>

      {item.state === 'in-progress' && item.progress != null && item.total != null && (
        <div
          style={{
            height: 4,
            borderRadius: 'var(--r-pill)',
            background: 'var(--surface-raised)',
            overflow: 'hidden',
            marginLeft: 22,
          }}
        >
          <div
            style={{
              height: '100%',
              width: '100%',
              background: 'var(--uc-orange)',
              borderRadius: 'var(--r-pill)',
              transform: `scaleX(${Math.min(100, (item.progress / item.total) * 100) / 100})`,
              transformOrigin: 'left center',
              transition: 'transform 250ms cubic-bezier(0.23, 1, 0.32, 1)',
            }}
          />
        </div>
      )}
    </div>
  )
}

/**
 * Self-hides once every step is done — the widget exists to be finished, so a completed
 * profile should reclaim the space rather than show a wall of ticks. The one exception
 * is the 2s "all set" beat, which catches the incomplete→complete transition.
 */
export function ProfileProgressWidget() {
  const [justCompleted, setJustCompleted] = useState(false)
  const wasIncompleteRef = useRef(false)

  const { data: progress, isLoading } = useQuery({
    queryKey: ['users', 'me', 'progress'],
    queryFn: () => api.get<{ data: UserProgress }>('/users/me/progress').then((r) => r.data.data),
    staleTime: 30_000,
  })

  const progressIncomplete =
    progress != null &&
    (progress.profileScore < 100 ||
      !progress.hasMadePost ||
      progress.connectionCount < 10 ||
      !progress.isVerified)

  useEffect(() => {
    if (progress == null) return
    if (wasIncompleteRef.current && !progressIncomplete) {
      wasIncompleteRef.current = false
      setJustCompleted(true)
      const t = setTimeout(() => setJustCompleted(false), 2000)
      return () => clearTimeout(t)
    }
    wasIncompleteRef.current = progressIncomplete
  }, [progressIncomplete, progress])

  return (
    <AnimatePresence>
      {isLoading ? (
        <motion.div
          key="progress-loading"
          layout
          variants={listItem}
          exit={{ opacity: 0, height: 0 }}
          style={{ overflow: 'hidden' }}
        >
          <RailSlot>
            <SectionHeader title="Your progress" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ padding: '8px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <SkeletonLine width={14} height={14} />
                  <SkeletonLine width="60%" />
                </div>
              ))}
            </div>
          </RailSlot>
        </motion.div>
      ) : justCompleted && progress ? (
        <motion.div
          key="progress-complete"
          layout
          variants={listItem}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: DUR.med, ease: EASE_OUT_EXPO }}
          style={{ overflow: 'hidden' }}
        >
          <RailSlot>
            <SectionHeader title="Your progress" />
            <p
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--uc-mint)',
                margin: 0,
                padding: '8px 0',
              }}
            >
              All set — profile complete
            </p>
          </RailSlot>
        </motion.div>
      ) : progressIncomplete && progress ? (
        <motion.div
          key="progress-incomplete"
          layout
          variants={listItem}
          exit={{ opacity: 0, height: 0 }}
          style={{ overflow: 'hidden' }}
        >
          <RailSlot>
            <SectionHeader title="Your progress" />
            <div>
              {(
                [
                  {
                    icon: progress.profileScore === 100 ? CheckCircle2 : Circle,
                    label: 'Profile complete',
                    state: progress.profileScore === 100 ? 'done' : 'in-progress',
                    progress: progress.profileScore,
                    total: 100,
                  },
                  {
                    icon: progress.hasMadePost ? CheckCircle2 : Circle,
                    label: 'First post',
                    state: progress.hasMadePost ? 'done' : 'in-progress',
                  },
                  {
                    icon: progress.connectionCount >= 10 ? CheckCircle2 : Circle,
                    label: '10 connections',
                    state: progress.connectionCount >= 10 ? 'done' : 'in-progress',
                    progress: Math.min(progress.connectionCount, 10),
                    total: 10,
                  },
                  {
                    icon: progress.isVerified ? CheckCircle2 : Lock,
                    label: 'Get verified',
                    state: progress.isVerified ? 'done' : 'locked',
                  },
                ] as BadgeProgressItem[]
              ).map((item) => (
                <BadgeProgressRow key={item.label} item={item} />
              ))}
            </div>
            <p
              style={{
                fontSize: 12,
                color: 'var(--text-tertiary)',
                margin: '10px 0 0',
                lineHeight: 1.5,
              }}
            >
              Finish your profile to unlock the campus directory.
            </p>
          </RailSlot>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
