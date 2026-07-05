import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowRight, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface OrbitalNode {
  id: number
  title: string
  subtitle: string
  content: string
  icon: LucideIcon
  relatedIds: number[]
  /** CSS var string, e.g. 'var(--uc-indigo-l)' */
  accent: string
  /** CSS var string, e.g. 'var(--uc-indigo-bg)' */
  accentBg: string
  /** CSS var string, e.g. 'var(--uc-indigo-bdr)' */
  accentBdr: string
  energy: number
}

interface RadialOrbitalTimelineProps {
  nodes: OrbitalNode[]
  height?: number
  motionEnabled?: boolean
  label?: string
}

const ORBIT_RADIUS = 168
/* expo-out for all node micro-interactions */
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

export function RadialOrbitalTimeline({
  nodes,
  height = 480,
  motionEnabled = true,
  label = 'Interactive product model',
}: RadialOrbitalTimelineProps) {
  const [expanded, setExpanded]   = useState<number | null>(null)
  const [hovered,  setHovered]    = useState<number | null>(null)
  const [rotation, setRotation]   = useState(0)
  const [autoRotate, setAutoRotate] = useState(true)
  const containerRef  = useRef<HTMLDivElement>(null)
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const resumeTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shouldAutoRotate = motionEnabled && autoRotate

  /* ── Auto-rotation ─────────────────────────────────── */
  useEffect(() => {
    if (!shouldAutoRotate) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = setInterval(() => {
      setRotation(prev => Number(((prev + 0.22) % 360).toFixed(3)))
    }, 50)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [shouldAutoRotate])

  /* ── Snap to top-right on expand ───────────────────── */
  function centerViewOnNode(id: number) {
    const idx = nodes.findIndex(n => n.id === id)
    if (idx < 0) return
    const naturalAngle = (idx / nodes.length) * 360
    const target = ((45 - naturalAngle) % 360 + 360) % 360
    setRotation(target)
  }

  /* ── Hover handlers (pause/resume rotation) ─────────── */
  const handleNodeEnter = useCallback((id: number) => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current)
    setHovered(id)
    setAutoRotate(false)
  }, [])

  const handleNodeLeave = useCallback(() => {
    setHovered(null)
    /* Brief delay before resuming so rapid swipes don't strobe */
    resumeTimer.current = setTimeout(() => {
      setExpanded(prev => { if (prev === null) setAutoRotate(true); return prev })
    }, 320)
  }, [])

  /* ── Toggle expand ──────────────────────────────────── */
  function toggleNode(id: number) {
    if (expanded === id) {
      setExpanded(null)
      setAutoRotate(true)
    } else {
      setExpanded(id)
      setAutoRotate(false)
      centerViewOnNode(id)
    }
  }

  function handleBgClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === containerRef.current) {
      setExpanded(null)
      setAutoRotate(true)
    }
  }

  /* ── Node position with depth cues ─────────────────── */
  function getPos(index: number) {
    const angle = ((index / nodes.length) * 360 + rotation) % 360
    const rad   = (angle * Math.PI) / 180
    const x     = ORBIT_RADIUS * Math.cos(rad)
    const y     = ORBIT_RADIUS * Math.sin(rad)
    const depth = (1 + Math.sin(rad)) / 2
    const zIndex  = Math.round(100 + 50 * Math.cos(rad))
    const opacity = Math.max(0.3, Math.min(1, 0.3 + 0.7 * depth))
    const scale   = Math.max(0.78, Math.min(1, 0.78 + 0.22 * depth))
    return { x, y, zIndex, opacity, scale }
  }

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={label}
      data-motion-active={shouldAutoRotate ? 'true' : 'false'}
      onClick={handleBgClick}
      style={{
        position: 'relative',
        width: '100%',
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
      }}
    >
      {/* Orbit ring */}
      <div
        style={{
          position: 'absolute',
          width: ORBIT_RADIUS * 2,
          height: ORBIT_RADIUS * 2,
          borderRadius: '50%',
          border: '0.5px solid var(--border-default)',
          pointerEvents: 'none',
        }}
      />

      {/* Center orb */}
      <div
        className="uc-orbital-center"
        style={{
          position: 'absolute',
          width: 54,
          height: 54,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, var(--uc-indigo-l), var(--uc-orange))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: 'var(--surface-page)',
            opacity: 0.88,
          }}
        />
        <div
          className="uc-orbital-ping-1"
          style={{
            position: 'absolute',
            top: -10, right: -10, bottom: -10, left: -10,
            borderRadius: '50%',
            border: '1px solid rgba(91,91,214,0.30)',
            pointerEvents: 'none',
          }}
        />
        <div
          className="uc-orbital-ping-2"
          style={{
            position: 'absolute',
            top: -20, right: -20, bottom: -20, left: -20,
            borderRadius: '50%',
            border: '1px solid rgba(91,91,214,0.14)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Orbital nodes */}
      {nodes.map((node, i) => {
        const pos        = getPos(i)
        const isExpanded = expanded === node.id
        const isHovered  = hovered  === node.id && !isExpanded
        const isRelated  = expanded !== null
          ? (nodes.find(n => n.id === expanded)?.relatedIds.includes(node.id) ?? false)
          : false
        const Icon = node.icon

        /* Halo grows on hover */
        const haloBase   = node.energy * 0.45 + 44

        /* Icon scale: expanded > hovered > default */
        const iconScale  = isExpanded ? 1.40 : isHovered ? 1.18 : 1

        /* Outer wrapper: depth scale only when not expanded/hovered */
        const wrapperScale = (isExpanded || isHovered) ? 1 : pos.scale

        return (
          <div
            role="button"
            tabIndex={0}
            aria-label={`${node.title}: ${node.content}`}
            key={node.id}
            onMouseEnter={() => handleNodeEnter(node.id)}
            onMouseLeave={handleNodeLeave}
            onClick={e => { e.stopPropagation(); toggleNode(node.id) }}
            onKeyDown={e => {
              if (e.target !== e.currentTarget) return
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                toggleNode(node.id)
              }
            }}
            style={{
              position: 'absolute',
              transform: `translate(${pos.x}px, ${pos.y}px) scale(${wrapperScale})`,
              zIndex: isExpanded ? 250 : isHovered ? 200 : pos.zIndex,
              opacity: (isExpanded || isHovered) ? 1 : pos.opacity,
              transition: `opacity 0.35s ${EASE}, transform 0.35s ${EASE}`,
              cursor: 'pointer',
            }}
          >
            {/* ── Glow halo ── */}
            <div
              className={isRelated && !isHovered ? 'uc-orbital-halo-pulse' : undefined}
              style={{
                position: 'absolute',
                borderRadius: '50%',
                background: `radial-gradient(circle, ${node.accentBg} 0%, transparent 70%)`,
                width:  haloBase,
                height: haloBase,
                top:    -(haloBase - 40) / 2,
                left:   -(haloBase - 40) / 2,
                pointerEvents: 'none',
                opacity: isExpanded ? 1 : isHovered ? 1 : isRelated ? 0.9 : 0.55,
                transform: isHovered ? 'scale(1.28)' : 'scale(1)',
                transition: `transform 240ms ${EASE}, opacity 240ms ${EASE}`,
              }}
            />

            {/* ── Hover: outer ring (box-shadow double ring) ── */}
            {/* Rendered as box-shadow on icon button, not extra DOM */}

            {/* ── Hover: orbit spark arcs ── */}
            {isHovered && (
              <>
                {/* Fast arc */}
                <div
                  className="uc-orbital-spark"
                  style={{
                    position: 'absolute',
                    top: -6, right: -6, bottom: -6, left: -6,
                    borderRadius: '50%',
                    border: '1.5px solid transparent',
                    borderTopColor: node.accent,
                    pointerEvents: 'none',
                  }}
                />
                {/* Slow counter-arc — creates gyroscope layering */}
                <div
                  className="uc-orbital-spark-slow"
                  style={{
                    position: 'absolute',
                    top: -10, right: -10, bottom: -10, left: -10,
                    borderRadius: '50%',
                    border: '1px solid transparent',
                    borderTopColor: node.accentBdr,
                    pointerEvents: 'none',
                  }}
                />
              </>
            )}

            {/* ── Icon button ── */}
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isExpanded
                  ? node.accent
                  : (isHovered || isRelated)
                    ? node.accentBg
                    : 'var(--surface-raised)',
                border: `1.5px solid ${
                  isExpanded
                    ? node.accent
                    : (isHovered || isRelated)
                      ? node.accent
                      : 'var(--border-hover)'
                }`,
                boxShadow: isExpanded
                  ? `0 0 20px ${node.accentBg}`
                  : isHovered
                    ? `0 0 0 4px ${node.accentBg}, 0 0 22px ${node.accentBg}`
                    : 'none',
                transform: `scale(${iconScale})`,
                transition: `all 240ms ${EASE}`,
                color: isExpanded ? 'var(--surface-page)' : node.accent,
                position: 'relative',
              }}
            >
              <Icon size={15} />
            </div>

            {/* ── Label ── */}
            <div
              style={{
                position: 'absolute',
                top: 47,
                left: '50%',
                transform: `translateX(-50%) translateY(${isHovered ? -3 : 0}px) scale(${isExpanded ? 1.1 : 1})`,
                whiteSpace: 'nowrap',
                fontSize: 11,
                fontWeight: isHovered ? 500 : 400,
                letterSpacing: '0.2px',
                color: (isExpanded || isHovered)
                  ? 'var(--text-primary)'
                  : 'var(--text-secondary)',
                transition: `color 200ms ${EASE}, transform 240ms ${EASE}, font-weight 200ms ease`,
                pointerEvents: 'none',
              }}
            >
              {node.title}
            </div>

            {/* ── Expanded popover — always opens upward ── */}
            {isExpanded && (
              <div
                className="uc-orbital-popover"
                style={{
                  position: 'absolute',
                  bottom: 52,
                  left: '50%',
                  width: 224,
                  background: 'var(--surface-raised)',
                  border: `0.5px solid ${node.accentBdr}`,
                  borderRadius: 'var(--r-lg)',
                  padding: '14px 16px',
                  boxShadow: '0 4px 24px var(--overlay-bg-soft)',
                  zIndex: 300,
                }}
                onClick={e => e.stopPropagation()}
              >
                {/* Connector line — points down toward the icon */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: -9,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 1,
                    height: 9,
                    background: node.accentBdr,
                  }}
                />

                {/* Badge + energy % */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 9,
                  }}
                >
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      background: node.accentBg,
                      border: `0.5px solid ${node.accentBdr}`,
                      borderRadius: 'var(--r-pill)',
                      padding: '2px 9px',
                      fontSize: 10,
                      fontWeight: 500,
                      color: node.accent,
                    }}
                  >
                    <Icon size={9} />
                    {node.subtitle}
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    {node.energy}%
                  </span>
                </div>

                <p
                  style={{
                    margin: '0 0 12px',
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.65,
                  }}
                >
                  {node.content}
                </p>

                {/* Activity bar */}
                <div style={{ marginBottom: node.relatedIds.length > 0 ? 12 : 0 }}>
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 10,
                      color: 'var(--text-tertiary)',
                      marginBottom: 5,
                    }}
                  >
                    <Zap size={9} />
                    Activity
                  </span>
                  <div
                    style={{
                      height: 3,
                      borderRadius: 999,
                      background: 'var(--border-default)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${node.energy}%`,
                        background: node.accent,
                        borderRadius: 999,
                      }}
                    />
                  </div>
                </div>

                {/* Related nodes */}
                {node.relatedIds.length > 0 && (
                  <>
                    <div
                      style={{
                        height: '0.5px',
                        background: 'var(--border-default)',
                        margin: '0 0 9px',
                      }}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {node.relatedIds.map(rid => {
                        const rel = nodes.find(n => n.id === rid)
                        if (!rel) return null
                        return (
                          <button
                            key={rid}
                            onClick={e => { e.stopPropagation(); toggleNode(rid) }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              background: 'var(--surface-hover)',
                              border: '0.5px solid var(--border-hover)',
                              borderRadius: 'var(--r-pill)',
                              padding: '3px 9px',
                              fontSize: 10,
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                            }}
                          >
                            {rel.title}
                            <ArrowRight size={8} />
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
