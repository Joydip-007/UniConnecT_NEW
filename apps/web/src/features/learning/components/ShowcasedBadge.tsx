import { useUserBadges } from '../hooks/useLearning'

interface Props {
  userId: string
  size?: number
}

export function ShowcasedBadge({ userId, size = 16 }: Props) {
  const { data: badges } = useUserBadges(userId)
  const showcased = badges?.find((b) => b.isShowcased)

  if (!showcased) return null

  return (
    <span
      aria-label={showcased.name}
      title={showcased.name}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: 'var(--r-pill)',
        background: 'var(--uc-amber-bg)',
        border: '0.5px solid var(--uc-amber-bdr)',
        color: 'var(--uc-amber-l)',
        fontSize: size * 0.6,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {showcased.iconUrl ?? '\u{1F3C5}'}
    </span>
  )
}
