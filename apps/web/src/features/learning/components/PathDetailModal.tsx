import { useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import {
  ArrowRight, Award, BookOpen, CalendarCheck, Check, CheckCircle2, ChevronRight, History, ListChecks, Lock,
  Play, PlayCircle, RotateCcw,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useToastStore } from '@/stores/toastStore'
import { api } from '@/lib/axios'
import { streakToastMessage, useAbandon, useCompleteUnit, useEnroll, usePath, useUnitAttempts } from '../hooks/useLearning'
import { PATH_STATUS_META, pathStatus } from '../pathFilters'
import type { LearningUnit, PathDetail, TodayEntry } from '../types'
import { LearnDialog, ProgressBar, StatusPill } from './learnUi'
import { linkButton, pathMeta, pillButton, plural, unitKindLabel } from '../learnFormat'
import { VideoLesson } from './VideoLesson'

type UnitState = 'completed' | 'next' | 'locked'

interface PathDetailModalProps {
  pathId: string
  /** Open unit, or null for the path overview. */
  unitId: string | null
  onSelectUnit: (unitId: string | null) => void
  onClose: () => void
  onStartQuiz: (unitId: string) => void
  onShowResults: (unitId: string) => void
  /** This path's entry in today's plan, if it has one. */
  today?: TodayEntry
}

function errorMessage(err: unknown, fallback: string) {
  if (isAxiosError(err) && typeof err.response?.data?.error === 'string') return err.response.data.error
  return fallback
}

function derive(path: PathDetail) {
  const status = pathStatus(path.enrollment?.status ?? null)
  const started = status === 'active' || status === 'completed'
  const next = status === 'active' ? path.units.find((u) => !u.completed) : undefined
  const stateOf = (u: LearningUnit): UnitState => (u.completed ? 'completed' : next?.id === u.id ? 'next' : 'locked')
  const count = path.units.filter((u) => u.completed).length
  return { status, started, next, stateOf, count }
}

function lockReason(started: boolean, next: LearningUnit | undefined) {
  return !started || !next ? 'Start this path to unlock its units' : `Finish "${next.title}" first`
}

export function PathDetailModal({
  pathId, unitId, onSelectUnit, onClose, onStartQuiz, onShowResults, today,
}: PathDetailModalProps) {
  const { data: path } = usePath(pathId)
  const enroll = useEnroll()
  const abandon = useAbandon()
  const complete = useCompleteUnit()
  const show = useToastStore((s) => s.show)
  const queryClient = useQueryClient()
  const [watched, setWatched] = useState<Record<string, boolean>>({})
  // The unit finished from this dialog today, so its banner can say what comes next.
  const [finishedToday, setFinishedToday] = useState<string | null>(null)

  const unit = path?.units.find((u) => u.id === unitId) ?? null
  const isQuiz = unit?.type === 'quiz'
  const { data: attempts } = useUnitAttempts(unit && isQuiz && unit.content ? unit.id : null)

  useEffect(() => {
    setFinishedToday((prev) => (prev === unitId ? prev : null))
  }, [unitId])

  if (!path) {
    return (
      <LearnDialog label="Skill path" title="Loading…" onClose={onClose}>
        <div style={{ height: 160, borderRadius: 'var(--r-md)', background: 'var(--surface-card)' }} />
      </LearnDialog>
    )
  }

  const { status, started, next, stateOf, count } = derive(path)
  const n = path.units.length
  const todayUnit = today && !today.completedToday ? path.units.find((u) => u.id === today.unit.id) : undefined

  async function startOrRestart() {
    try {
      await enroll.mutateAsync(pathId)
      const fresh = await queryClient.fetchQuery({
        queryKey: ['learning', 'path', { pathId }],
        queryFn: () => api.get<{ data: PathDetail }>(`/learning/paths/${pathId}`).then((r) => r.data.data),
      })
      const resumeAt = fresh.units.find((u) => !u.completed) ?? fresh.units[0]
      show({ message: status === 'dropped' ? 'Path restarted' : 'Enrolled. Your first unit is ready', type: 'success' })
      if (resumeAt) onSelectUnit(resumeAt.id)
    } catch (err) {
      show({ message: errorMessage(err, 'Could not start this path'), type: 'error' })
    }
  }

  function handleAbandon() {
    abandon.mutate(pathId, {
      onSuccess: () => {
        show({
          message: 'Path abandoned',
          // Re-enroll + invalidate directly (not via enroll.mutate's onSuccess) so the undo
          // still works after this dialog has unmounted.
          onUndo: () => {
            void api.post(`/learning/paths/${pathId}/enroll`).then(() => {
              void queryClient.invalidateQueries({ queryKey: ['learning'] })
            })
          },
        })
      },
      onError: (err) => show({ message: errorMessage(err, 'Could not abandon this path'), type: 'error' }),
    })
  }

  function handleMarkComplete(u: LearningUnit) {
    complete.mutate(
      { unitId: u.id },
      {
        onSuccess: (res) => {
          if (todayUnit?.id === u.id) setFinishedToday(u.id)
          show({ message: streakToastMessage(res.streak.currentStreak), type: 'success' })
          if (res.pathCompleted) show({ message: 'Path complete! Badge on its way', type: 'success' })
        },
        onError: (err) => show({ message: errorMessage(err, 'Could not complete this unit'), type: 'error' }),
      },
    )
  }

  // ── Unit view ────────────────────────────────────────────────────────────
  if (unit) {
    const index = path.units.findIndex((u) => u.id === unit.id)
    const st = stateOf(unit)
    const locked = st === 'locked'
    const done = st === 'completed'
    const body = unit.content?.body ?? unit.content?.text ?? ''
    const videoUrl = unit.type === 'video' ? unit.content?.video_url : undefined
    const hasPlayer = !locked && !!videoUrl
    const canMark = !hasPlayer || !!watched[unit.id]
    const passScore = unit.completion_rule?.passScore ?? 70
    const nextInPath = path.units[index + 1]
    const onToday = todayUnit?.id === unit.id || finishedToday === unit.id
    const bestScore = attempts && attempts.length ? Math.max(...attempts.map((a) => a.score)) : null
    const readMeta = isQuiz
      ? plural(unit.questionCount ?? 0, 'question')
      : unit.type === 'video'
        ? unit.minutes
          ? `${unit.minutes} min video`
          : 'Video'
        : unit.minutes
          ? `${unit.minutes} min read`
          : ''

    return (
      <LearnDialog
        label="Skill path unit"
        title={unit.title}
        sub={`${path.title} · unit ${index + 1} of ${n}`}
        onBack={() => onSelectUnit(null)}
        onClose={onClose}
        footer={
          <>
            {!isQuiz && !done && !locked && (
              <>
                <button
                  type="button"
                  onClick={() => canMark && handleMarkComplete(unit)}
                  aria-disabled={!canMark || complete.isPending}
                  className="press-feedback"
                  style={{ ...pillButton(canMark ? 'primary' : 'disabled'), opacity: complete.isPending ? 0.6 : 1 }}
                >
                  <Check size={14} aria-hidden="true" />
                  Mark complete
                </button>
                {hasPlayer && (
                  <span style={{ flex: 1, minWidth: 160, fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {canMark
                      ? 'Video watched. You can mark this unit complete.'
                      : 'Watch the whole video to mark this unit complete.'}
                  </span>
                )}
              </>
            )}
            {isQuiz && !locked && (
              <>
                <button type="button" onClick={() => onStartQuiz(unit.id)} className="press-feedback" style={pillButton('primary')}>
                  {attempts && attempts.length ? 'Retake quiz' : 'Start quiz'}
                </button>
                {attempts && attempts.length > 0 && (
                  <button type="button" onClick={() => onShowResults(unit.id)} style={linkButton}>
                    <History size={14} aria-hidden="true" />
                    Past results · {attempts.length}
                  </button>
                )}
              </>
            )}
            {done && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--uc-mint)' }}>
                <CheckCircle2 size={15} aria-hidden="true" />
                Completed
              </span>
            )}
            {done && nextInPath && (
              <button
                type="button"
                onClick={() => onSelectUnit(nextInPath.id)}
                className="press-feedback interactive-surface"
                style={{ ...pillButton('outline'), marginLeft: 'auto' }}
              >
                Next unit
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            )}
          </>
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: 'var(--text-label)' }}>
          {isQuiz ? <ListChecks size={14} aria-hidden="true" /> : <PlayCircle size={14} aria-hidden="true" />}
          {isQuiz ? `${unitKindLabel(unit)} · pass mark ${passScore}%` : unitKindLabel(unit)}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: 14,
            borderRadius: 'var(--r-md)',
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: 'var(--text-label)' }}>
              <BookOpen size={13} aria-hidden="true" />
              {isQuiz ? 'What this quiz checks' : 'About this topic'}
            </span>
            {readMeta && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{readMeta}</span>}
          </div>
          {unit.summary && (
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.5 }}>{unit.summary}</p>
          )}
          {body && !locked && body !== unit.summary && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, textWrap: 'pretty', whiteSpace: 'pre-line' }}>
              {body}
            </p>
          )}
        </div>

        {locked && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 14px',
              borderRadius: 'var(--r-md)',
              background: 'var(--surface-card)',
              border: '0.5px solid var(--border-default)',
            }}
          >
            <Lock size={16} color="var(--text-tertiary)" aria-hidden="true" />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{lockReason(started, next)}</span>
          </div>
        )}

        {hasPlayer && videoUrl && (
          <VideoLesson
            key={unit.id}
            src={videoUrl}
            minutes={unit.minutes ?? null}
            done={done}
            onWatched={() => setWatched((w) => ({ ...w, [unit.id]: true }))}
          />
        )}

        {isQuiz && !locked && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              padding: '12px 14px',
              borderRadius: 'var(--r-md)',
              background: 'var(--surface-card)',
              border: '0.5px solid var(--border-default)',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
              {bestScore === null ? 'Not attempted yet' : `Best ${bestScore}% · ${plural(attempts?.length ?? 0, 'attempt')}`}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {st === 'next' ? `Score ${passScore}% or more to complete this unit.` : 'You can retake this quiz any time.'}
            </span>
          </div>
        )}

        {onToday && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 'var(--r-md)',
              background: 'var(--uc-orange-bg)',
              border: '0.5px solid var(--uc-orange-bdr)',
            }}
          >
            <CalendarCheck size={15} color="var(--uc-orange-l)" aria-hidden="true" style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>
              {done ? "Done. That was the last item on today's plan." : "On today's plan. This is the last one for today."}
            </span>
          </div>
        )}
      </LearnDialog>
    )
  }

  // ── Overview ─────────────────────────────────────────────────────────────
  const meta = PATH_STATUS_META[status]
  const pending = enroll.isPending || abandon.isPending

  return (
    <LearnDialog
      label="Skill path"
      title={path.title}
      sub={pathMeta(path)}
      onClose={onClose}
      footer={
        status === 'new' ? (
          <button type="button" onClick={startOrRestart} disabled={pending} className="press-feedback" style={pillButton('primary')}>
            <Play size={14} aria-hidden="true" />
            Start path
          </button>
        ) : status === 'active' ? (
          <>
            <button
              type="button"
              onClick={() => next && onSelectUnit(next.id)}
              className="press-feedback"
              style={pillButton('primary')}
            >
              {next ? `Continue: ${next.title}` : 'Continue'}
            </button>
            <button
              type="button"
              onClick={handleAbandon}
              disabled={pending}
              className="press-feedback interactive-surface"
              style={pillButton('outline')}
            >
              Abandon path
            </button>
          </>
        ) : status === 'dropped' ? (
          <button type="button" onClick={startOrRestart} disabled={pending} className="press-feedback" style={pillButton('primary')}>
            <RotateCcw size={14} aria-hidden="true" />
            Restart path
          </button>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--uc-mint)' }}>
            <Award size={15} aria-hidden="true" />
            {`Path complete${path.badge_name ? ` · ${path.badge_name} badge earned` : ''}`}
          </span>
        )
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
      </div>
      {path.description && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{path.description}</p>
      )}

      {status === 'active' && todayUnit && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: 12,
            borderRadius: 'var(--r-md)',
            background: 'var(--uc-orange-bg)',
            border: '0.5px solid var(--uc-orange-bdr)',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: 'var(--uc-orange-l)' }}>
            <CalendarCheck size={14} aria-hidden="true" />
            Left for today · 1
          </span>
          <button
            type="button"
            onClick={() => onSelectUnit(todayUnit.id)}
            className="interactive-surface"
            style={{
              width: '100%',
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 10px',
              borderRadius: 'var(--r-sm)',
              border: '0.5px solid var(--border-default)',
              background: 'var(--surface-card)',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            {todayUnit.type === 'quiz' ? (
              <ListChecks size={15} color="var(--uc-orange-l)" aria-hidden="true" style={{ flexShrink: 0 }} />
            ) : (
              <PlayCircle size={15} color="var(--uc-orange-l)" aria-hidden="true" style={{ flexShrink: 0 }} />
            )}
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{todayUnit.title}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 1 }}>
                {unitKindLabel(todayUnit)}
                {stateOf(todayUnit) === 'next' ? ' · up next' : ''}
              </span>
            </span>
            <ChevronRight size={16} color="var(--text-tertiary)" aria-hidden="true" />
          </button>
        </div>
      )}

      {status === 'active' && today?.completedToday && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            borderRadius: 'var(--r-md)',
            background: 'var(--uc-mint-bg)',
            border: '0.5px solid var(--uc-mint-bdr)',
            fontSize: 13,
            color: 'var(--text-primary)',
          }}
        >
          <Check size={14} color="var(--uc-mint)" aria-hidden="true" />
          Today&apos;s plan for this path is done. Come back tomorrow.
        </div>
      )}

      {count > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <ProgressBar pct={n ? Math.round((100 * count) / n) : 0} />
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {count} of {n} units complete
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {path.units.map((u) => {
          const st = stateOf(u)
          const isToday = todayUnit?.id === u.id
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => onSelectUnit(u.id)}
              className="interactive-surface"
              style={{
                width: '100%',
                minHeight: 48,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                borderRadius: 'var(--r-md)',
                border: `0.5px solid ${st === 'next' ? 'var(--uc-indigo-bdr)' : 'var(--border-default)'}`,
                background: st === 'next' ? 'var(--uc-indigo-bg)' : 'var(--surface-card)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {st === 'next' ? (
                <span
                  aria-label="Up next"
                  style={{ width: 15, height: 15, borderRadius: '50%', border: '1.5px solid var(--uc-indigo-l)', flexShrink: 0, boxSizing: 'border-box' }}
                />
              ) : st === 'completed' ? (
                <Check size={15} color="var(--uc-mint)" aria-label="Completed" style={{ flexShrink: 0 }} />
              ) : (
                <Lock size={15} color="var(--text-tertiary)" aria-label="Locked" style={{ flexShrink: 0 }} />
              )}
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: 13,
                      color: st === 'locked' ? 'var(--text-tertiary)' : 'var(--text-primary)',
                      fontWeight: st === 'next' ? 500 : 400,
                    }}
                  >
                    {u.title}
                  </span>
                  {isToday && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: 'var(--uc-orange-l)',
                        background: 'var(--uc-orange-bg)',
                        border: '0.5px solid var(--uc-orange-bdr)',
                        borderRadius: 'var(--r-pill)',
                        padding: '1px 7px',
                      }}
                    >
                      Today
                    </span>
                  )}
                </span>
                {u.summary && (
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.4 }}>
                    {u.summary}
                  </span>
                )}
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{unitKindLabel(u)}</span>
              </span>
              <ChevronRight size={16} color="var(--text-tertiary)" aria-hidden="true" style={{ flexShrink: 0 }} />
            </button>
          )
        })}
      </div>
    </LearnDialog>
  )
}
