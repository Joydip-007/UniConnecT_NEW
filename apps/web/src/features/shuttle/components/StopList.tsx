import { CheckCircle2 } from 'lucide-react'
import type { ProgressResult, ShuttleRoute } from '../types'

interface StopListProps {
  route: ShuttleRoute
  hasLocation: boolean
  derived: ProgressResult
  atFinalStop: boolean
}

export function StopList({ route, hasLocation, derived, atFinalStop }: StopListProps) {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '16px 20px',
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
          All stops
        </h3>
        <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>
          {route.stops.length} stops on this route
        </span>
      </div>

      <div>
        {route.stops.map((stop, i) => {
          const passed = hasLocation && i < derived.nearestStopIdx
          const nearest = hasLocation && i === derived.nearestStopIdx
          const isNext =
            hasLocation && i === derived.nextStopIdx && i !== derived.nearestStopIdx && !atFinalStop
          const isLast = i === route.stops.length - 1

          return (
            <div
              key={stop.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 0',
                borderBottom: isLast ? 'none' : '0.5px solid var(--border-default)',
              }}
            >
              <div
                style={{
                  width: 20,
                  display: 'flex',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {passed ? (
                  <CheckCircle2 size={14} strokeWidth={1.5} color="var(--uc-indigo)" />
                ) : (
                  <div
                    style={{
                      width: nearest ? 12 : 8,
                      height: nearest ? 12 : 8,
                      borderRadius: '50%',
                      background: nearest ? 'var(--uc-indigo-l)' : 'transparent',
                      border: `0.5px solid ${nearest ? 'var(--uc-indigo)' : 'var(--border-default)'}`,
                      transition: 'background 300ms, border-color 300ms',
                    }}
                  />
                )}
              </div>

              <span
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontWeight: nearest || isNext ? 500 : 400,
                  color: passed
                    ? 'var(--text-tertiary)'
                    : nearest || isNext
                      ? 'var(--text-primary)'
                      : 'var(--text-secondary)',
                  transition: 'color 300ms',
                }}
              >
                {stop.name}
              </span>

              {nearest && !atFinalStop && (
                <Pill
                  bg="var(--uc-indigo-bg)"
                  border="var(--uc-indigo-bdr)"
                  color="var(--uc-indigo-xl)"
                  text="Here"
                />
              )}
              {isNext && (
                <Pill
                  bg="var(--uc-orange-bg)"
                  border="var(--uc-orange-bdr)"
                  color="var(--uc-orange-l)"
                  text="Next"
                />
              )}
              {atFinalStop && nearest && (
                <Pill
                  bg="var(--uc-mint-bg)"
                  border="var(--uc-mint-bdr)"
                  color="var(--uc-mint)"
                  text="Arrived"
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Pill({ bg, border, color, text }: { bg: string; border: string; color: string; text: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 500,
        padding: '2px 8px',
        borderRadius: 'var(--r-pill)',
        background: bg,
        border: `0.5px solid ${border}`,
        color,
        flexShrink: 0,
      }}
    >
      {text}
    </span>
  )
}
