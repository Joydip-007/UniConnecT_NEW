import { useEffect } from 'react'

interface ShortcutHandlers {
  onCompose: () => void
  onToggleHelp: () => void
  onCloseHelp: () => void
  helpOpen: boolean
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return false
}

function focusPostByOffset(offset: 1 | -1) {
  const articles = Array.from(
    document.querySelectorAll<HTMLElement>('[data-feed-post]'),
  )
  if (articles.length === 0) return

  const viewportMid = window.innerHeight / 2
  let currentIndex = articles.findIndex((el) => {
    const r = el.getBoundingClientRect()
    return r.top <= viewportMid && r.bottom >= viewportMid
  })
  if (currentIndex === -1) {
    currentIndex = offset > 0 ? -1 : articles.length
  }

  const nextIndex = Math.max(0, Math.min(articles.length - 1, currentIndex + offset))
  const target = articles[nextIndex]
  if (!target) return
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
  target.setAttribute('tabindex', '-1')
  target.focus({ preventScroll: true })
}

export function useFeedShortcuts({
  onCompose,
  onToggleHelp,
  onCloseHelp,
  helpOpen,
}: ShortcutHandlers) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Always allow Escape to close help, even from inputs
      if (e.key === 'Escape' && helpOpen) {
        e.preventDefault()
        onCloseHelp()
        return
      }

      if (isTypingTarget(e.target)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      switch (e.key) {
        case 'j':
          e.preventDefault()
          focusPostByOffset(1)
          return
        case 'k':
          e.preventDefault()
          focusPostByOffset(-1)
          return
        case 'c':
          e.preventDefault()
          onCompose()
          return
        case '?':
          e.preventDefault()
          onToggleHelp()
          return
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onCompose, onToggleHelp, onCloseHelp, helpOpen])
}
