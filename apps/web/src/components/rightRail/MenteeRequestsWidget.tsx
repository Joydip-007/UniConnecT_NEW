import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Avatar } from '@/components/Avatar'
import type { IncomingRequest } from '@/features/mentorship/types'
import { api } from '@/lib/axios'
import { PATHS } from '@/router/paths'
import { Section, SectionHeader, SkeletonLine, WidgetShell } from './primitives'
import { avatarColor, getInitials } from '@/utils/avatar'

interface PageResult<T> {
  items: T[]
  total: number
  page: number
  hasMore: boolean
}

/**
 * Alumni only — `GET /mentorship/requests/incoming` is `requireRole('alumni','admin')`,
 * and accepting is an alumni action, so no other role gets this widget. Deciding happens
 * on the mentorship page; the widget's job is to say that someone is waiting.
 */
export function MenteeRequestsWidget() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['mentorship', 'incoming', { status: 'pending', limit: 3 }],
    queryFn: () =>
      api
        .get<{ data: PageResult<IncomingRequest> }>('/mentorship/requests/incoming', {
          params: { page: 1, limit: 3, status: 'pending' },
        })
        .then((r) => r.data.data),
    staleTime: 30_000,
  })

  const requests = data?.items ?? []

  if (!isLoading && requests.length === 0) return null

  return (
    <WidgetShell>
      <Section>
        <SectionHeader title="Mentee requests" onSeeAll={() => navigate(PATHS.MENTORSHIP)} />

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[0, 1].map((i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'var(--surface-raised)',
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <SkeletonLine width="60%" />
                  <SkeletonLine width="80%" height={10} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            {requests.map((request, i, arr) => (
              <button
                key={request.id}
                onClick={() => navigate(PATHS.MENTORSHIP)}
                className="interactive-surface"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  width: '100%',
                  padding: '8px 0',
                  background: 'none',
                  border: 'none',
                  borderBottom: i === arr.length - 1 ? 'none' : '0.5px solid var(--border-default)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Avatar
                  src={request.student.avatarUrl}
                  initials={getInitials(request.student.fullName)}
                  color={avatarColor(request.student.id)}
                  size={36}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      lineHeight: 1.3,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {request.student.fullName}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-tertiary)',
                      marginTop: 2,
                      lineHeight: 1.4,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {request.message}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Section>
    </WidgetShell>
  )
}
