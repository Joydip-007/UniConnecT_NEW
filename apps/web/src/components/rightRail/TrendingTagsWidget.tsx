import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { PATHS } from '@/router/paths'
import { EyebrowLabel, RailSlot, WidgetShell } from './primitives'

interface TrendingTag {
  name: string
  postCount: number
}

export function useTrendingTags() {
  return useQuery({
    queryKey: ['feed', 'trending'],
    queryFn: () =>
      api
        .get<{ data: { trendingTags: TrendingTag[] } }>('/posts/trending')
        .then((r) => r.data.data.trendingTags),
    staleTime: 60_000,
  })
}

/** The chip list on its own, so a page-scoped rail can place it under its own header. */
export function TrendingTagsList({ tags }: { tags: TrendingTag[] }) {
  const navigate = useNavigate()
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {tags.map((tag) => (
        <button
          key={tag.name}
          type="button"
          onClick={() => navigate(`${PATHS.EXPLORE}?q=%23${encodeURIComponent(tag.name)}`)}
          className="press-feedback"
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--uc-indigo-l)',
            background: 'var(--uc-indigo-bg)',
            border: '0.5px solid var(--uc-indigo-bdr)',
            borderRadius: 'var(--r-pill)',
            padding: '3px 9px',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
          }}
        >
          #{tag.name} · {tag.postCount}
        </button>
      ))}
    </div>
  )
}

/** A borderless strip rather than a card — it is a jumping-off point, not a record. */
export function TrendingTagsWidget() {
  const { data: tags } = useTrendingTags()

  if (!tags || tags.length === 0) return null

  return (
    <WidgetShell>
      <RailSlot>
        <EyebrowLabel>Trending now</EyebrowLabel>
        <TrendingTagsList tags={tags} />
      </RailSlot>
    </WidgetShell>
  )
}
