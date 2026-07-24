import type { MutableRefObject, Ref, RefCallback } from 'react'

/** Combines multiple refs (object or callback) into a single callback ref for one DOM node. */
export function mergeRefs<T>(...refs: Array<Ref<T> | undefined>): RefCallback<T> {
  return (value) => {
    refs.forEach((ref) => {
      if (typeof ref === 'function') {
        ref(value)
      } else if (ref) {
        ;(ref as MutableRefObject<T | null>).current = value
      }
    })
  }
}
