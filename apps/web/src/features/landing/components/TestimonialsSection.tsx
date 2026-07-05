import { useScrollReveal } from '@/features/landing/hooks/useScrollReveal'

const TESTIMONIALS = [
  {
    quote:
      'I messaged a UIU alumnus through UniConnecT and got a referral at Shohoz within two weeks. No cold LinkedIn DMs, no awkward Facebook groups. Just one platform that actually works for us.',
    name: 'Rafid Ahsan',
    role: 'CSE · Batch 2023 · UIU',
    initials: 'RA',
    avatarColor: 'var(--uc-indigo)',
  },
  {
    quote:
      'As a faculty member, I used to post jobs on Facebook and pray someone saw them. With UniConnecT I reached 200 relevant students in my department directly. This is what we needed.',
    name: 'Dr. Nusrat Karim',
    role: 'Asst. Professor · CSE · UIU',
    initials: 'NK',
    avatarColor: 'var(--uc-orange)',
  },
] as const

export function TestimonialsSection() {
  const sectionRef = useScrollReveal<HTMLDivElement>()

  return (
    <section id="testimonials" className="uc-landing-section">
      <div ref={sectionRef} className="uc-section-shell uc-testimonials-wrap">
        <div className="uc-section-header uc-testimonials-header">
          <div className="reveal" data-delay="0">
            <p className="uc-section-eyebrow">Field notes</p>
            <h2 className="uc-section-title">Early proof from the people already closest to the problem.</h2>
          </div>
          <p className="reveal uc-section-copy uc-testimonials-copy" data-delay="80">
            The value shows up when hiring, faculty outreach, and student coordination all happen
            inside one verified graph rather than in parallel channels.
          </p>
        </div>

        <div className="uc-testimonials-grid">
          {TESTIMONIALS.map(({ quote, name, role, initials, avatarColor }, index) => (
            <div
              key={name}
              className="reveal uc-testimonial-card"
              data-delay={String(180 + index * 100)}
            >
              <div className="uc-testimonial-mark">&ldquo;</div>
              <p className="uc-testimonial-quote">{quote}</p>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <div
                  style={{
                    width: '2.375rem',
                    height: '2.375rem',
                    borderRadius: '50%',
                    background: avatarColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    flexShrink: 0,
                  }}
                >
                  {initials}
                </div>
                <div>
                  <p className="uc-testimonial-name">{name}</p>
                  <p className="uc-testimonial-role">{role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
