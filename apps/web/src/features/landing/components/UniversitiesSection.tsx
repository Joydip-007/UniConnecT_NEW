import { CheckCircle } from '@phosphor-icons/react'
import type { CSSProperties } from 'react'
import { OrangeBtn } from '@/components/Button'
import { useScrollReveal } from '@/features/landing/hooks/useScrollReveal'

const BENEFITS = [
  'Replace fragmented WhatsApp groups and Facebook pages with a single verified network',
  'Faculty reach the right students directly by department, batch, and role',
  'Alumni stay engaged and post real opportunities back to current students',
  'Admins get a central dashboard for announcements, events, and campus logistics',
] as const

const TENANTS = [
  {
    name: 'UIU',
    accent: 'var(--uc-orange)',
    tone: 'var(--uc-orange-bg)',
    note: 'Pilot tenant · student feed, jobs, events',
  },
  {
    name: 'BUET',
    accent: 'var(--uc-indigo)',
    tone: 'var(--uc-indigo-bg)',
    note: 'Engineering communities · alumni hiring loops',
  },
  {
    name: 'DU',
    accent: 'var(--uc-mint)',
    tone: 'var(--uc-mint-bg)',
    note: 'Faculty broadcast · cross-department coordination',
  },
] as const

export function UniversitiesSection() {
  const sectionRef = useScrollReveal<HTMLDivElement>()

  return (
    <section id="universities" className="uc-landing-section">
      <div ref={sectionRef} className="uc-section-shell uc-universities-wrap">
        <div className="uc-section-header uc-universities-header">
          <div className="reveal" data-delay="0">
            <p className="uc-section-eyebrow">For universities</p>
            <h2 className="uc-section-title">Multi-tenant by design, branded one campus at a time.</h2>
            <p className="uc-section-copy">
              Each institution gets a private, verified network with its own tenant accent,
              audience controls, and operating rhythm. The product feels shared. The data and
              identity boundaries do not.
            </p>
          </div>

          <div className="reveal uc-universities-cta" data-delay="120">
            <OrangeBtn
              onClick={() => {
                const el = document.querySelector('#pricing')
                if (el) {
                  el.scrollIntoView({
                    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                  })
                }
              }}
            >
              See pricing
            </OrangeBtn>
          </div>
        </div>

        <div className="uc-universities-grid">
          <div className="reveal uc-universities-stage" data-delay="80">
            <div className="uc-universities-stage-head">
              <p className="uc-universities-stage-label">Tenant sweep</p>
              <p className="uc-universities-stage-note">One platform, multiple campus identities.</p>
            </div>

            <div className="uc-universities-stage-list">
              {TENANTS.map(({ name, accent, tone, note }) => (
                <article
                  key={name}
                  className="uc-tenant-row"
                  style={
                    {
                      '--tenant-accent': accent,
                      '--tenant-tone': tone,
                    } as CSSProperties
                  }
                >
                  <div className="uc-tenant-crest" aria-hidden="true">
                    {name}
                  </div>
                  <div className="uc-tenant-copy">
                    <p className="uc-tenant-name">{name}</p>
                    <p className="uc-tenant-note">{note}</p>
                  </div>
                  <span className="uc-tenant-accent-bar" aria-hidden="true" />
                </article>
              ))}
            </div>
          </div>

          <div className="uc-universities-benefits">
            {BENEFITS.map((text, index) => (
              <div
                key={text}
                className="reveal uc-university-benefit"
                data-delay={String(180 + index * 70)}
              >
                <CheckCircle
                  size="1.125rem"
                  style={{ color: 'var(--uc-mint)', flexShrink: 0, marginTop: '0.125rem' }}
                />
                <p className="uc-university-benefit-copy">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
