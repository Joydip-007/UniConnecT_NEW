import { useScrollReveal } from '@/features/landing/hooks/useScrollReveal'

interface Step {
  num: string
  accent: string
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    num: '01',
    accent: 'var(--uc-indigo-l)',
    title: 'Verify your university email',
    body: 'Sign up with your official university email; UIU students use @uiu.ac.bd. Only verified members join.',
  },
  {
    num: '02',
    accent: 'var(--uc-orange-l)',
    title: 'Set up your campus profile',
    body: 'Add your department, batch year, skills, and headline. Alumni add career info. Everyone gets a verified identity.',
  },
  {
    num: '03',
    accent: 'var(--uc-mint)',
    title: 'Connect, post, and explore',
    body: 'Follow classmates and alumni, join your department group, browse jobs, RSVP to events, and start messaging.',
  },
]

export function HowItWorks() {
  const sectionRef = useScrollReveal<HTMLDivElement>()

  return (
    <section id="how-it-works">
      <div
        ref={sectionRef}
        className="uc-how-wrap"
        style={{ maxWidth: 1240, margin: '0 auto', padding: '72px 52px 96px' }}
      >
        <h2
          className="reveal"
          data-delay="0"
          style={{
            margin: 0,
            maxWidth: 560,
            fontSize: 'clamp(32px, 4vw, 48px)',
            fontWeight: 500,
            letterSpacing: '-2px',
            lineHeight: 1.12,
            color: 'var(--text-primary)',
          }}
        >
          Up and running in three steps.
        </h2>

        {/* Steps track — no card containers; numbers carry the structure */}
        <div
          className="uc-how-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            columnGap: 48,
            rowGap: 48,
            marginTop: 72,
          }}
        >
          {STEPS.map(({ num, accent, title, body }, i) => (
            <div
              key={num}
              className="reveal"
              data-delay={String(120 + i * 90)}
              style={{
                position: 'relative',
                paddingTop: 24,
                borderTop: `0.5px solid ${accent}`,
              }}
            >
              <div
                style={{
                  fontSize: 'clamp(56px, 6vw, 88px)',
                  fontWeight: 500,
                  letterSpacing: '-3px',
                  lineHeight: 0.95,
                  color: accent,
                  marginBottom: 36,
                }}
              >
                {num}
              </div>

              <h3
                style={{
                  margin: '0 0 10px',
                  fontSize: 18,
                  fontWeight: 500,
                  letterSpacing: '-0.2px',
                  color: 'var(--text-primary)',
                  lineHeight: 1.3,
                }}
              >
                {title}
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.7,
                  maxWidth: '32ch',
                }}
              >
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
