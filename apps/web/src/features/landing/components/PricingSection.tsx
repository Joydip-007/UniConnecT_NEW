import { useScrollReveal } from '@/features/landing/hooks/useScrollReveal'
import { GhostBtn, OrangeBtn } from '@/components/Button'
import { useNavigate } from 'react-router-dom'
import { PATHS } from '@/router/paths'
import { Check } from 'lucide-react'

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
    <div
      style={{
        background: highlighted ? 'var(--surface-raised)' : 'var(--surface-card)',
        border: highlighted ? '0.5px solid rgba(91,91,214,.4)' : '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-xl)',
        padding: '36px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      <div>
        <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 500, letterSpacing: '0.06em', color: highlighted ? 'var(--uc-indigo-l)' : 'var(--text-tertiary)' }}>
          {name}
        </p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 'clamp(32px, 4vw, 44px)', fontWeight: 500, letterSpacing: '-1.5px', lineHeight: 1, color: 'var(--text-primary)' }}>
            {price}
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{priceNote}</span>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {description}
        </p>
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

      <div
        style={{
          borderTop: '0.5px solid var(--border-default)',
          paddingTop: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {features.map((f) => (
          <div key={f} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Check size={15} style={{ color: 'var(--uc-mint)', flexShrink: 0, marginTop: 2 }} />
            <span style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{f}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PricingSection() {
  const navigate    = useNavigate()
  const sectionRef  = useScrollReveal<HTMLDivElement>()

  return (
    <section id="pricing">
      <div
        ref={sectionRef}
        className="uc-pricing-wrap"
        style={{ maxWidth: 1240, margin: '0 auto', padding: '96px 52px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <p
            className="reveal"
            data-delay="0"
            style={{
              margin: '0 0 13px',
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.06em',
              color: 'var(--uc-indigo-l)',
            }}
          >
            Pricing
          </p>
          <h2
            className="reveal"
            data-delay="80"
            style={{
              margin: '0 0 14px',
              fontSize: 'clamp(32px, 4vw, 48px)',
              fontWeight: 500,
              letterSpacing: '-2px',
              lineHeight: 1.12,
              color: 'var(--text-primary)',
            }}
          >
            Free for students, always.
          </h2>
          <p
            className="reveal"
            data-delay="160"
            style={{
              margin: '0 auto',
              fontSize: 16,
              color: 'var(--text-secondary)',
              lineHeight: 1.75,
              maxWidth: 480,
            }}
          >
            Universities fund access for their community. Students never pay.
          </p>
        </div>

        <div
          className="uc-pricing-grid reveal"
          data-delay="200"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 16,
            maxWidth: 800,
            margin: '0 auto',
          }}
        >
          <PlanCard
            name="Students"
            price="$0"
            priceNote="forever"
            description="Full access to the UniConnecT platform — feed, jobs, events, chat, mentorship, and more."
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
              if (el) el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
            }}
          />
        </div>
      </div>

      <style>{`
        @media (max-width: 767px) {
          .uc-pricing-wrap { padding: 64px 20px !important; }
          .uc-pricing-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  )
}
