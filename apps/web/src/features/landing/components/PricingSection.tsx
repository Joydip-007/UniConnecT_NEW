import { Check } from '@phosphor-icons/react'
import { useNavigate } from 'react-router-dom'
import { GhostBtn, OrangeBtn } from '@/components/Button'
import { useScrollReveal } from '@/features/landing/hooks/useScrollReveal'
import { PATHS } from '@/router/paths'

interface PlanProps {
  name: string
  price: string
  priceNote: string
  description: string
  features: string[]
  cta: string
  highlighted: boolean
  onCta: () => void
}

function PlanCard({ name, price, priceNote, description, features, cta, highlighted, onCta }: PlanProps) {
  return (
    <article className={`uc-pricing-card${highlighted ? ' is-highlighted' : ''}`}>
      <div>
        <p className={`uc-pricing-plan-label${highlighted ? ' is-highlighted' : ''}`}>{name}</p>
        <div className="uc-pricing-price-row">
          <span className="uc-pricing-price">{price}</span>
          <span className="uc-pricing-price-note">{priceNote}</span>
        </div>
        <p className="uc-pricing-description">{description}</p>
      </div>

      {highlighted ? (
        <OrangeBtn onClick={onCta} style={{ width: '100%', justifyContent: 'center' }}>
          {cta}
        </OrangeBtn>
      ) : (
        <GhostBtn onClick={onCta} style={{ width: '100%', justifyContent: 'center' }}>
          {cta}
        </GhostBtn>
      )}

      <div className="uc-pricing-feature-list">
        {features.map((feature) => (
          <div key={feature} style={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-start' }}>
            <Check size="0.9375rem" style={{ color: 'var(--uc-mint)', flexShrink: 0, marginTop: '0.125rem' }} />
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{feature}</span>
          </div>
        ))}
      </div>
    </article>
  )
}

export function PricingSection() {
  const navigate = useNavigate()
  const sectionRef = useScrollReveal<HTMLDivElement>()

  return (
    <section id="pricing" className="uc-landing-section">
      <div ref={sectionRef} className="uc-section-shell uc-pricing-wrap">
        <div className="uc-section-header uc-pricing-header">
          <div className="reveal" data-delay="0">
            <p className="uc-section-eyebrow">Pricing</p>
            <h2 className="uc-section-title">Free for students. Institution-funded at the tenant level.</h2>
          </div>
          <p className="reveal uc-section-copy uc-pricing-copy" data-delay="80">
            The model stays clean: students get the full campus network, while universities fund
            onboarding, controls, and branded deployment for their institution.
          </p>
        </div>

        <div className="uc-pricing-grid reveal" data-delay="160">
          <PlanCard
            name="Students"
            price="$0"
            priceNote="forever"
            description="Full access to the UniConnecT platform: feed, jobs, events, chat, mentorship, and more."
            features={[
              'Campus feed and social posts',
              'Job and internship listings',
              'Real-time direct and group chat',
              'Event discovery and RSVP',
              'Alumni mentorship requests',
              'Department groups and clubs',
            ]}
            cta="Get started free"
            highlighted={false}
            onCta={() => navigate(PATHS.REGISTER.replace(':token', 'invite'))}
          />
          <PlanCard
            name="Universities"
            price="Custom"
            priceNote="per institution"
            description="Private, verified network for your entire university. Branded, isolated, and admin-controlled."
            features={[
              'Everything in the student plan',
              'University-branded network',
              'Admin dashboard and analytics',
              'Staff and faculty role management',
              'Invitation and access control',
              'Priority support and onboarding',
            ]}
            cta="Contact us"
            highlighted={true}
            onCta={() => {
              const el = document.querySelector('#contact')
              if (el) {
                el.scrollIntoView({
                  behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                })
              }
            }}
          />
        </div>
      </div>
    </section>
  )
}
