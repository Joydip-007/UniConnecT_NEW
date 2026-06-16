import { useLayoutEffect, useRef } from 'react'

/**
 * Inserts an emoji string at the textarea's current cursor position.
 * Returns a stable `insert` function — call it from an emoji picker's onSelect.
 */
export function useEmojiInsert(
  ref: React.RefObject<HTMLTextAreaElement>,
  value: string,
  onChange: (next: string) => void,
) {
  const pendingCursor = useRef<number | null>(null)

  useLayoutEffect(() => {
    if (pendingCursor.current !== null && ref.current) {
      ref.current.setSelectionRange(pendingCursor.current, pendingCursor.current)
      pendingCursor.current = null
    }
  })

  function insert(emoji: string) {
    const el = ref.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const next = value.slice(0, start) + emoji + value.slice(end)
    onChange(next)
    pendingCursor.current = start + emoji.length
    el?.focus()
  }

  return insert
}
