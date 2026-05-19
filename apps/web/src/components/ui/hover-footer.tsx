import { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'

export const TextHoverEffect = ({
  text,
  duration,
  className,
}: {
  text: string
  duration?: number
  className?: string
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const [cursor, setCursor] = useState({ x: 0, y: 0 })
  const [hovered, setHovered] = useState(false)
  const [maskPosition, setMaskPosition] = useState({ cx: '50%', cy: '50%' })

  // Update mask position whenever the cursor moves
  useEffect(() => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const cxPercentage = ((cursor.x - rect.left) / rect.width) * 100
    const cyPercentage = ((cursor.y - rect.top)  / rect.height) * 100
    setMaskPosition({ cx: `${cxPercentage}%`, cy: `${cyPercentage}%` })
  }, [cursor])

  // Track cursor via document so the animation works even when another element
  // sits on top of the SVG (e.g. the footer bottom bar at a higher z-index).
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      const inside =
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top  && e.clientY <= rect.bottom
      setHovered(inside)
      if (inside) setCursor({ x: e.clientX, y: e.clientY })
    }
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox="0 0 450 100"
      xmlns="http://www.w3.org/2000/svg"
      style={{ pointerEvents: 'none' }}
      className={['select-none', className].filter(Boolean).join(' ')}
    >
      <defs>
        <linearGradient
          id="ucTextGradient"
          gradientUnits="userSpaceOnUse"
          cx="50%"
          cy="50%"
          r="25%"
        >
          {hovered && (
            <>
              <stop offset="0%"   stopColor="var(--uc-orange)" />
              <stop offset="25%"  stopColor="var(--uc-indigo-l)" />
              <stop offset="50%"  stopColor="var(--uc-cyan)" />
              <stop offset="75%"  stopColor="var(--uc-mint)" />
              <stop offset="100%" stopColor="var(--uc-indigo)" />
            </>
          )}
        </linearGradient>

        <motion.radialGradient
          id="ucRevealMask"
          gradientUnits="userSpaceOnUse"
          r="20%"
          initial={{ cx: '50%', cy: '50%' }}
          animate={maskPosition}
          transition={{ duration: duration ?? 0, ease: 'easeOut' }}
        >
          <stop offset="0%"   stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </motion.radialGradient>

        <mask id="ucTextMask">
          <rect x="0" y="0" width="100%" height="100%" fill="url(#ucRevealMask)" />
        </mask>
      </defs>

      {/* Ghost outline — widens on hover, adapts stroke to theme */}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        strokeWidth="0.4"
        style={{
          fill: 'transparent',
          stroke: 'var(--footer-hover-ghost)',
          fontFamily: 'var(--font-display)',
          fontSize: '5.5rem',
          fontWeight: 500,
          letterSpacing: '-0.04em',
          textTransform: 'uppercase',
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.35s ease',
        }}
      >
        {text}
      </text>

      {/* Animated draw-in stroke — adapts to theme */}
      <motion.text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        strokeWidth="0.35"
        style={{
          fill: 'transparent',
          stroke: 'var(--footer-resting-stroke)',
          fontFamily: 'var(--font-display)',
          fontSize: '5.5rem',
          fontWeight: 500,
          letterSpacing: '-0.04em',
          textTransform: 'uppercase',
        }}
        initial={{ strokeDashoffset: 1000, strokeDasharray: 1000 }}
        animate={{ strokeDashoffset: 0, strokeDasharray: 1000 }}
        transition={{ duration: 4, ease: 'easeInOut' }}
      >
        {text}
      </motion.text>

      {/* Color-reveal on cursor hover */}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        stroke="url(#ucTextGradient)"
        strokeWidth="0.3"
        mask="url(#ucTextMask)"
        style={{
          fill: 'transparent',
          fontFamily: 'var(--font-display)',
          fontSize: '5.5rem',
          fontWeight: 500,
          letterSpacing: '-0.04em',
          textTransform: 'uppercase',
        }}
      >
        {text}
      </text>
    </svg>
  )
}

export const FooterBackgroundGradient = () => (
  <>
    {/* Theme tokens for the hover-text SVG — defined here so they're co-located */}
    <style>{`
      :root, :root[data-theme='dark'] {
        --footer-resting-stroke: var(--uc-indigo);
        --footer-hover-ghost:    var(--border-strong);
        --footer-bg-gradient:    radial-gradient(125% 125% at 50% 10%, transparent 30%, var(--uc-indigo-bg) 100%);
      }
      :root[data-theme='light'] {
        --footer-resting-stroke: var(--uc-indigo);
        --footer-hover-ghost:    rgba(26, 31, 46, 0.30);
        --footer-bg-gradient:    radial-gradient(125% 125% at 50% 10%, transparent 20%, rgba(71,71,194,0.06) 70%, rgba(212,74,31,0.04) 100%);
      }
    `}</style>
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        background: 'var(--footer-bg-gradient)',
        pointerEvents: 'none',
      }}
    />
  </>
)
