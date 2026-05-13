import { useNavigate } from 'react-router-dom'
import { OrangeBtn, GhostBtn } from '@/components/Button'
import { PATHS } from '@/router/paths'
import { useScrollReveal } from '@/features/landing/hooks/useScrollReveal'

export function CtaSection() {
  const navigate  = useNavigate()
  const cardRef   = useScrollReveal<HTMLDivElement>()

  return (
    <section className="uc-cta-section" style={{ maxWidth: 1136, margin: '0 auto 88px', padding: '0 52px' }}>
      {/* Card is the scroll-reveal container */}
      <div ref={cardRef}>
        <div
          className="reveal uc-cta-card"
          data-delay="0"
          style={{
            background: 'var(--surface-raised)',
            border: '0.5px solid rgba(91,91,214,.3)',
            borderRadius: 28,
            padding: '76px 64px',
            textAlign: 'center',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Background — center orb */}
          <div
            style={{
              position: 'absolute',
              width: 500,
              height: 500,
              borderRadius: '50%',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'radial-gradient(circle, rgba(91,91,214,.12) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          {/* Background — corner orb */}
          <div
            style={{
              position: 'absolute',
              width: 300,
              height: 300,
              borderRadius: '50%',
              top: -50,
              right: 80,
              background: 'radial-gradient(circle, rgba(240,90,40,.08) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          {/* Content */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Tag pill */}
            <div
              style={{
                display: 'inline-block',
                background: 'var(--uc-orange-bg)',
                border: '0.5px solid var(--uc-orange-bdr)',
                borderRadius: 999,
                padding: '5px 16px',
                fontSize: 12,
                color: 'var(--uc-orange-l)',
                marginBottom: 22,
              }}
            >
              Join UniConnecT — always free for students
            </div>

            {/* H2 — font-weight 800 (CTA heading exception for landing) */}
            <h2
              style={{
                margin: '0 0 17px',
                fontSize: 'clamp(36px, 4vw, 52px)',
                fontWeight: 800,
                letterSpacing: '-2px',
                lineHeight: 1.1,
                color: 'var(--text-primary)',
              }}
            >
              Ready to reconnect your campus?
            </h2>

            <p
              style={{
                margin: '0 auto 38px',
                fontSize: 17,
                color: 'var(--text-secondary)',
                lineHeight: 1.7,
                maxWidth: 520,
              }}
            >
              UniConnecT brings students, alumni, faculty, and staff onto one private,
              university-verified network — for free, forever.
            </p>

            {/* Button row */}
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <OrangeBtn
                style={{ padding: '11px 28px', fontSize: 15 }}
                onClick={() => navigate(PATHS.REGISTER.replace(':token', 'invite'))}
              >
                Get started free
              </OrangeBtn>
              <GhostBtn
                style={{ padding: '11px 24px', fontSize: 15 }}
                onClick={() => navigate('/contact')}
              >
                For universities →
              </GhostBtn>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
