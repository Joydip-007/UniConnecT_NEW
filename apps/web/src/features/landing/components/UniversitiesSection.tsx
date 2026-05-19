import { useScrollReveal } from '@/features/landing/hooks/useScrollReveal'
import { OrangeBtn } from '@/components/Button'
import { CheckCircle } from 'lucide-react'

const BENEFITS = [
  'Replace fragmented WhatsApp groups and Facebook pages with a single verified network',
  'Faculty reach the right students directly — by department, batch, and role',
  'Alumni stay engaged and post real opportunities back to current students',
  'Admin have a central dashboard for announcements, events, and campus logistics',
]

export function UniversitiesSection() {
  const sectionRef = useScrollReveal<HTMLDivElement>()

  return (
    <section id="universities">
      <div
        ref={sectionRef}
        className="uc-universities-wrap"
        style={{ maxWidth: 1240, margin: '0 auto', padding: '96px 52px' }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 80,
            alignItems: 'center',
          }}
          className="uc-universities-grid"
        >
          {/* Left */}
          <div>
            <p
              className="reveal"
              data-delay="0"
              style={{
                margin: '0 0 13px',
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.06em',
                color: 'var(--uc-orange-l)',
              }}
            >
              For universities
            </p>
            <h2
              className="reveal"
              data-delay="80"
              style={{
                margin: '0 0 20px',
                fontSize: 'clamp(32px, 4vw, 48px)',
                fontWeight: 500,
                letterSpacing: '-2px',
                lineHeight: 1.12,
                color: 'var(--text-primary)',
              }}
            >
              Built to serve an entire institution.
            </h2>
            <p
              className="reveal"
              data-delay="160"
              style={{
                margin: '0 0 36px',
                fontSize: 16,
                color: 'var(--text-secondary)',
                lineHeight: 1.75,
                maxWidth: 480,
              }}
            >
              UniConnecT is multi-tenant by design. Each university gets its own private, verified
              network — isolated from every other institution, branded with your identity.
            </p>
            <OrangeBtn
              className="reveal"
              data-delay="240"
              onClick={() => {
                const el = document.querySelector('#pricing')
                if (el) el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
              }}
            >
              See pricing
            </OrangeBtn>
          </div>

          {/* Right — benefits list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {BENEFITS.map((text, i) => (
              <div
                key={i}
                className="reveal"
                data-delay={String(160 + i * 80)}
                style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}
              >
                <CheckCircle
                  size={18}
                  style={{ color: 'var(--uc-mint)', flexShrink: 0, marginTop: 2 }}
                />
                <p style={{ margin: 0, fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 767px) {
          .uc-universities-wrap { padding: 64px 20px !important; }
          .uc-universities-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
        }
      `}</style>
    </section>
  )
}
