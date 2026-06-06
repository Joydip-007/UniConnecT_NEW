import { useEffect, useState } from 'react'

interface AvatarProps {
  initials: string
  color: string
  size?: number
  online?: boolean
  src?: string | null
}

export function Avatar({ initials, color, size = 40, online = false, src }: AvatarProps) {
  const [imgFailed, setImgFailed] = useState(false)
  const dotSize = Math.round(size * 0.27)

  // Reset failure flag whenever src changes
  useEffect(() => {
    setImgFailed(false)
  }, [src])

  const showImage = !!src && !imgFailed

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: showImage ? 'transparent' : color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.34,
        fontWeight: 500,
        // Initials sit on a saturated fallback fill (AVATAR_COLORS), so the label
        // must use the theme-stable --on-accent — never --text-primary, which flips
        // to dark navy in light mode and drops to ~1.5:1 on the navy slot.
        color: 'var(--on-accent)',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {showImage ? (
        <img
          src={src}
          alt=""
          onError={() => setImgFailed(true)}
          style={{
            width: size,
            height: size,
            objectFit: 'cover',
            borderRadius: '50%',
            display: 'block',
          }}
        />
      ) : (
        initials
      )}
      {online && (
        <div
          style={{
            position: 'absolute',
            bottom: 1,
            right: 1,
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            background: 'var(--uc-mint)',
            border: '2px solid var(--surface-card)',
          }}
        />
      )}
    </div>
  )
}
