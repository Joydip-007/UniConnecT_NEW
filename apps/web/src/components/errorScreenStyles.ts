import type { CSSProperties } from 'react'

/** Primary and ghost actions: a centred row on desktop, full-width 44px stack on a phone. */
export function errorActionsStyle(compact: boolean): CSSProperties {
  return compact
    ? { display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }
    : { display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }
}

export const compactBtnClass = 'min-h-[44px] !text-[14px] w-full'
