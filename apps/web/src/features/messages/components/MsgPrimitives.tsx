import { useState } from 'react'

/** Round avatar at the Messages design's exact sizes (initials size is set per use, not derived). */
export function MsgAvatar({
  size,
  fontSize,
  initials,
  color,
  src,
}: {
  size: number
  fontSize: number
  initials: string
  color: string
  src?: string | null
}) {
  const [failed, setFailed] = useState<string | null>(null)
  const showImage = !!src && failed !== src
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize,
        fontWeight: 500,
        color: 'var(--on-accent)',
        background: showImage ? 'var(--surface-raised)' : color,
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {showImage ? (
        <img
          src={src}
          alt=""
          onError={() => setFailed(src)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        initials
      )}
    </div>
  )
}

/** Mint presence dot over an avatar corner. `ring` is the surface the avatar sits on. */
export function OnlineDot({ size, ring, offset = 0 }: { size: number; ring: string; offset?: number }) {
  return (
    <span
      aria-label="Online"
      style={{
        position: 'absolute',
        bottom: offset,
        right: offset,
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--uc-mint)',
        border: `2px solid ${ring}`,
        boxSizing: 'border-box',
      }}
    />
  )
}

export function TypingDots({ size, color }: { size: number; color: string }) {
  return (
    <>
      {['msgx-dot1', 'msgx-dot2', 'msgx-dot3'].map((cls) => (
        <span
          key={cls}
          className={cls}
          style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'inline-block' }}
        />
      ))}
    </>
  )
}
