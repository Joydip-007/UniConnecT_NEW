import { formatDistanceToNowStrict } from 'date-fns'

/** Cyan is the page's only live colour. The age shows the fix is real, not stale. */
export function LiveBadge({ updatedAt }: { updatedAt: string | null }) {
  const age = updatedAt ? formatDistanceToNowStrict(new Date(updatedAt), { roundingMethod: 'floor' }) : null
  return (
    <span className="shuttle-live-pill shuttle-live-pill--lg">
      <span className="shuttle-live-dot" />
      Live{age ? ` · ${age.replace(/ seconds?/, 's').replace(/ minutes?/, 'm')} ago` : ''}
    </span>
  )
}
