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
  return (
    <section id="testimonials">
      <div className="uc-testimonials-wrap" style={{ maxWidth: 1240, margin: '0 auto', padding: '0 52px 96px' }}>

        {/* Header */}
        <p
          style={{
            margin: '0 0 13px',
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            color: 'var(--uc-indigo-l)',
          }}
        >
          From the campus
        </p>
        <h2
          style={{
            margin: '0 0 48px',
            fontSize: 'clamp(32px, 4vw, 48px)',
            fontWeight: 800,
            letterSpacing: '-2px',
            lineHeight: 1.12,
            color: 'var(--text-primary)',
          }}
        >
          What students are saying.
        </h2>

        {/* Cards grid */}
        <div
          className="uc-testimonials-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 16,
          }}
        >
          {TESTIMONIALS.map(({ quote, name, role, initials, avatarColor }) => (
            <div
              key={name}
              style={{
                background: 'var(--surface-card)',
                border: '0.5px solid var(--border-default)',
                borderRadius: 22,
                padding: 32,
                transition: 'border-color 0.3s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-hover)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)' }}
            >
              {/* Quote mark */}
              <div
                style={{
                  fontSize: 48,
                  fontFamily: 'Georgia, serif',
                  color: 'var(--uc-indigo)',
                  lineHeight: 1,
                  marginBottom: 12,
                  opacity: 0.7,
                }}
              >
                &ldquo;
              </div>

              {/* Quote text */}
              <p
                style={{
                  margin: '0 0 20px',
                  fontSize: 15,
                  fontStyle: 'italic',
                  color: 'var(--text-primary)',
                  lineHeight: 1.78,
                  opacity: 0.88,
                }}
              >
                {quote}
              </p>

              {/* Author row */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: avatarColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'white',
                    flexShrink: 0,
                  }}
                >
                  {initials}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {name}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                    {role}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
