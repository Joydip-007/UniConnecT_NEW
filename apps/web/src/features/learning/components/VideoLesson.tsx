import { useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { ProgressBar } from './learnUi'

interface VideoLessonProps {
  src: string
  /** Authored length, used for the "N of M min watched" line until metadata loads. */
  minutes: number | null
  /** Already completed: the unit reads as watched and the bar is full. */
  done: boolean
  onWatched: () => void
}

/** Seeking further than this past the furthest point reached does not count as watching. */
const MAX_CONTINUOUS_JUMP_S = 1.5

/**
 * A video unit's player. "Watched" means the learner reached the end by playing through,
 * not by scrubbing: only continuous playback advances the furthest-watched mark, so
 * "Mark complete" cannot be unlocked by dragging to the end.
 */
export function VideoLesson({ src, minutes, done, onWatched }: VideoLessonProps) {
  const [duration, setDuration] = useState<number | null>(null)
  const [furthest, setFurthest] = useState(0)
  const [watched, setWatched] = useState(done)
  const furthestRef = useRef(0)

  const total = duration ?? (minutes ? minutes * 60 : null)
  const pct = done || watched ? 100 : total ? Math.min(100, Math.round((100 * furthest) / total)) : 0
  const totalMin = total ? Math.max(1, Math.round(total / 60)) : null
  const watchedMin = total ? Math.round((pct / 100) * (total / 60)) : 0

  function markWatched() {
    if (watched) return
    setWatched(true)
    onWatched()
  }

  return (
    <div style={{ borderRadius: 'var(--r-md)', overflow: 'hidden', border: '0.5px solid var(--border-default)', background: 'var(--surface-card)' }}>
      <div
        style={{
          height: 220,
          backgroundColor: 'var(--surface-page)',
          backgroundImage: 'radial-gradient(circle, var(--border-default) 1px, transparent 1px)',
          backgroundSize: '14px 14px',
        }}
      >
        <video
          src={src}
          controls
          preload="metadata"
          playsInline
          aria-label="Lesson video"
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration
            if (Number.isFinite(d) && d > 0) setDuration(d)
          }}
          onTimeUpdate={(e) => {
            const t = e.currentTarget.currentTime
            if (t <= furthestRef.current + MAX_CONTINUOUS_JUMP_S && t > furthestRef.current) {
              furthestRef.current = t
              setFurthest(t)
            }
            const d = e.currentTarget.duration
            if (Number.isFinite(d) && d > 0 && furthestRef.current >= d - MAX_CONTINUOUS_JUMP_S) markWatched()
          }}
          onEnded={() => {
            const d = duration ?? 0
            if (furthestRef.current >= d - MAX_CONTINUOUS_JUMP_S) markWatched()
          }}
          style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }}
        />
      </div>
      <ProgressBar pct={pct} color="var(--uc-orange)" />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '8px 12px',
          fontSize: 12,
          color: 'var(--text-tertiary)',
        }}
      >
        <span>{totalMin ? `${watchedMin} of ${totalMin} min watched` : `${pct}% watched`}</span>
        {(done || watched) && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--uc-mint)' }}>
            <Check size={13} aria-hidden="true" />
            Watched
          </span>
        )}
      </div>
    </div>
  )
}
