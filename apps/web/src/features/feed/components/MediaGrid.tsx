import { Play } from 'lucide-react'

interface Props {
  urls: string[]
  onOpen: (index: number) => void
}

function isVideo(url: string) {
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url)
}

export function MediaGrid({ urls, onOpen }: Props) {
  if (urls.length === 0) return null

  const count = urls.length

  // Single item
  if (count === 1) {
    return (
      <div style={{ borderRadius: 'var(--r-md)', overflow: 'hidden', marginBottom: 12 }}>
        <Slot url={urls[0]} index={0} onOpen={onOpen} aspectRatio="auto" maxHeight={560} />
      </div>
    )
  }

  // 2 photos: side-by-side equal squares
  if (count === 2) {
    return (
      <div style={gridWrap}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
          {urls.map((url, i) => (
            <Slot key={i} url={url} index={i} onOpen={onOpen} aspectRatio="1/1" />
          ))}
        </div>
      </div>
    )
  }

  // 3 photos: large left, two stacked right
  if (count === 3) {
    return (
      <div style={gridWrap}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, height: 360 }}>
          <Slot url={urls[0]} index={0} onOpen={onOpen} fill />
          <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: 3 }}>
            <Slot url={urls[1]} index={1} onOpen={onOpen} fill />
            <Slot url={urls[2]} index={2} onOpen={onOpen} fill />
          </div>
        </div>
      </div>
    )
  }

  // 4 photos: 2×2 grid
  if (count === 4) {
    return (
      <div style={gridWrap}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
          {urls.map((url, i) => (
            <Slot key={i} url={url} index={i} onOpen={onOpen} aspectRatio="1/1" />
          ))}
        </div>
      </div>
    )
  }

  // 5 photos: 2 on top, 3 on bottom
  if (count === 5) {
    return (
      <div style={gridWrap}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, height: 300 }}>
          <Slot url={urls[0]} index={0} onOpen={onOpen} fill />
          <Slot url={urls[1]} index={1} onOpen={onOpen} fill />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3, marginTop: 3, height: 200 }}>
          <Slot url={urls[2]} index={2} onOpen={onOpen} fill />
          <Slot url={urls[3]} index={3} onOpen={onOpen} fill />
          <Slot url={urls[4]} index={4} onOpen={onOpen} fill />
        </div>
      </div>
    )
  }

  // 6+: 3×2 grid, last cell shows "+N more" overlay
  const visible = urls.slice(0, 6)
  const hidden = urls.length - 6
  return (
    <div style={gridWrap}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3 }}>
        {visible.map((url, i) => {
          const isLast = i === 5 && hidden > 0
          return (
            <div key={i} style={{ position: 'relative', aspectRatio: '1/1', overflow: 'hidden' }}>
              <Slot url={url} index={i} onOpen={onOpen} fill />
              {isLast && (
                <button
                  type="button"
                  onClick={() => onOpen(i)}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'var(--overlay-media)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--on-accent)',
                    fontSize: 22,
                    fontWeight: 500,
                  }}
                >
                  +{hidden}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Slot ──────────────────────────────────────────────────────────────────────

interface SlotProps {
  url: string
  index: number
  onOpen: (i: number) => void
  aspectRatio?: string
  maxHeight?: number
  fill?: boolean
}

function Slot({ url, index, onOpen, aspectRatio, maxHeight, fill }: SlotProps) {
  const video = isVideo(url)
  const style: React.CSSProperties = {
    width: '100%',
    objectFit: 'cover',
    display: 'block',
    cursor: 'zoom-in',
    ...(fill
      ? { position: 'absolute', inset: 0, height: '100%' }
      : {
          aspectRatio: aspectRatio ?? '16/9',
          ...(maxHeight ? { maxHeight } : {}),
        }),
  }

  const wrapStyle: React.CSSProperties = fill
    ? { position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }
    : {}

  function handleClick() {
    onOpen(index)
  }

  const el = video ? (
    <div style={{ ...wrapStyle, background: '#000' }} /* intentional: media letterbox is theme-invariant black */>
      <video
        src={url}
        muted
        style={style}
        onClick={handleClick}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'var(--overlay-media)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Play size={20} fill="#fff" color="#fff" />
        </div>
      </div>
    </div>
  ) : (
    <img
      src={url}
      alt={`Media ${index + 1}`}
      loading="lazy"
      style={style}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick() } }}
      role="button"
      tabIndex={0}
    />
  )

  if (fill) {
    return <div style={wrapStyle}>{el}</div>
  }
  return el
}

const gridWrap: React.CSSProperties = {
  borderRadius: 'var(--r-md)',
  overflow: 'hidden',
  marginBottom: 12,
}
