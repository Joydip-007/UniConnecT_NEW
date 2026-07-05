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
    <section id="how-it-works" className="uc-landing-section">
      <div ref={sectionRef} className="uc-section-shell uc-how-wrap">
        <div className="uc-section-header uc-how-header">
          <div className="reveal" data-delay="0">
            <p className="uc-section-eyebrow">Onboarding</p>
            <h2 className="uc-section-title">Three moves to get a campus tenant live.</h2>
          </div>
          <p className="reveal uc-section-copy uc-how-copy" data-delay="80">
            The flow stays practical: verify identity, shape the profile, then move straight into
            the feed, groups, jobs, and messaging layer.
          </p>
        </div>

        <div className="uc-how-grid">
          {STEPS.map(({ num, accent, title, body }, index) => (
            <div
              key={num}
              className="reveal uc-how-step"
              data-delay={String(120 + index * 90)}
              style={{ borderTopColor: accent }}
            >
              <div className="uc-how-step-number" style={{ color: accent }}>
                {num}
              </div>
              <h3 className="uc-how-step-title">{title}</h3>
              <p className="uc-how-step-copy">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
