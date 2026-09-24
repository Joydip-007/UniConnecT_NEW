import { Link } from 'react-router-dom'
import { RoleBadge } from '@/components/RoleBadge'
import type { ResultRowData } from '../cardHelpers'
import { useExploreLinkState } from '../hooks/useExploreLinkState'
import { useLockedLinkGuard } from '../hooks/useLockedLinkGuard'

/** One bordered card of two-line result rows — the Explore design's search result list. */
export function SearchResultRows({ rows }: { rows: ResultRowData[] }) {
  const linkState = useExploreLinkState()
  const guard = useLockedLinkGuard()
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
        marginBottom: 16,
      }}
    >
      {rows.map((row, i) => (
        <Link
          state={linkState}
          key={row.id}
          to={row.to}
          onClick={guard(row.locked)}
          style={{
            display: 'block',
            padding: '10px 14px',
            borderBottom: i === rows.length - 1 ? 'none' : '0.5px solid var(--border-default)',
            fontSize: 14,
            textDecoration: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            {row.titleRole && <RoleBadge role={row.titleRole} size={14} tipPlacement="below" />}
            <span
              style={{
                fontWeight: 500,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 0,
              }}
            >
              {row.title}
            </span>
          </div>
          {row.meta && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>
              {row.metaRole && <RoleBadge role={row.metaRole} size={12} />}
              <span>{row.meta}</span>
            </div>
          )}
        </Link>
      ))}
    </div>
  )
}
