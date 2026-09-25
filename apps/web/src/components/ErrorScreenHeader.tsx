import { BrandLogo } from '@/components/BrandLogo'

/**
 * Logo bar for the full-screen error pages (404, app crash). They render outside the
 * app shell, so without it the page carries no sign of which product it belongs to.
 */
export function ErrorScreenHeader({ compact }: { compact: boolean }) {
  return (
    <div
      style={{
        height: compact ? 56 : 64,
        flexShrink: 0,
        padding: compact ? '0 18px' : '0 32px',
        display: 'flex',
        alignItems: 'center',
        borderBottom: '0.5px solid var(--border-default)',
      }}
    >
      <BrandLogo height={30} variant={compact ? 'mark' : 'full'} />
    </div>
  )
}
