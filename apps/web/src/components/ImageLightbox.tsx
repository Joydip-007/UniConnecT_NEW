import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

interface Props {
  images: string[]
  startIndex?: number
  onClose: () => void
}

/**
 * Full-screen image viewer (Facebook-style). Shows the image at its natural size
 * (object-fit: contain — never cropped), with backdrop/Esc to close and prev/next
 * navigation when more than one image is supplied. Reusable across posts, news and
 * events. Controls sit on a dark scrim, so their colours are intentionally fixed
 * light/dark rather than theme tokens.
 */
export function ImageLightbox({ images, startIndex = 0, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [index, setIndex] = useState(() => clamp(startIndex, images.length))
  const multiple = images.length > 1

  const go = useCallback(
    (delta: number) => setIndex((i) => (i + delta + images.length) % images.length),
    [images.length],
  )

  // Native <dialog> gives us focus trapping, Escape-to-close, and a backdrop for free.
  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

  // Native close (Escape, or dialog.close()) should notify the parent so it unmounts us.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    function handleClose() {
      onClose()
    }
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [onClose])

  // Arrow-key navigation between images.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' && multiple) go(1)
      else if (e.key === 'ArrowLeft' && multiple) go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, multiple])

  if (images.length === 0) return null

  return (
    <dialog
      ref={dialogRef}
      aria-label="Image viewer"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        margin: 0,
        maxWidth: 'none',
        maxHeight: 'none',
        width: '100%',
        height: '100%',
        border: 'none',
        background: 'rgba(8, 10, 20, 0.94)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        color: 'inherit',
      }}
    >
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{ ...chromeBtn, position: 'absolute', top: 16, right: 16 }}
      >
        <X size={20} strokeWidth={1.75} />
      </button>

      {/* Prev */}
      {multiple && (
        <button
          type="button"
          aria-label="Previous image"
          onClick={(e) => { e.stopPropagation(); go(-1) }}
          style={{ ...chromeBtn, position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }}
        >
          <ChevronLeft size={22} strokeWidth={1.75} />
        </button>
      )}

      {/* Image — stop propagation so clicking it doesn't close */}
      <img
        src={images[index]}
        alt={`Slide ${index + 1} of ${images.length}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          borderRadius: 'var(--r-md)',
          boxShadow: '0 8px 40px rgba(0, 0, 0, 0.5)',
        }}
      />

      {/* Next */}
      {multiple && (
        <button
          type="button"
          aria-label="Next image"
          onClick={(e) => { e.stopPropagation(); go(1) }}
          style={{ ...chromeBtn, position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)' }}
        >
          <ChevronRight size={22} strokeWidth={1.75} />
        </button>
      )}

      {/* Counter */}
      {multiple && (
        <span
          style={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 12,
            fontWeight: 500,
            color: 'rgba(255, 255, 255, 0.85)',
            background: 'rgba(0, 0, 0, 0.45)',
            padding: '4px 12px',
            borderRadius: 'var(--r-pill)',
          }}
        >
          {index + 1} / {images.length}
        </span>
      )}
    </dialog>
  )
}

const chromeBtn: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: '50%',
  background: 'rgba(255, 255, 255, 0.12)',
  border: 'none',
  color: 'rgba(255, 255, 255, 0.92)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
}

function clamp(i: number, len: number): number {
  if (len === 0) return 0
  return Math.min(Math.max(i, 0), len - 1)
}
