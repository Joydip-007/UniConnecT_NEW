import { useMemo } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { usePageRails } from '@/stores/pageRailStore'
import { NewsDraftEditor, NewsRightRail, newsSource, useNewsDetail } from '@/features/news'

/**
 * `/news/new` and `/news/:id/edit`. Only faculty and admins write news; the author
 * edits their own article and an admin can edit any. Anyone else is sent back to
 * where they came from rather than shown a form the API would refuse.
 */
export default function NewsDraftPage() {
  const { id } = useParams<{ id: string }>()
  const user = useAuthStore((s) => s.user)
  const { data, isLoading, isError } = useNewsDetail(id)

  const rightRail = useMemo(() => <NewsRightRail />, [])
  usePageRails(null, rightRail)

  if (!user) return null
  if (user.role !== 'faculty' && user.role !== 'admin') return <Navigate to={id ? `/news/${id}` : '/news'} replace />

  if (id) {
    if (isLoading) return <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>Loading article…</p>
    if (isError || !data) return <Navigate to="/news" replace />
    if (data.authorId !== user.id && user.role !== 'admin') return <Navigate to={`/news/${id}`} replace />
  }

  // The byline names the article's original office on an edit, the writer's on a new one.
  const sourceLabel = data
    ? newsSource(data.author, data.isImported)
    : newsSource(
        { id: user.id, fullName: user.profile?.fullName ?? null, avatarUrl: null, headline: null, department: user.profile?.department ?? null, role: user.role },
        false,
      )

  // Keyed by id so moving from one article's editor to another resets the form.
  return <NewsDraftEditor key={data?.id ?? 'new'} initial={data} sourceLabel={sourceLabel} />
}
