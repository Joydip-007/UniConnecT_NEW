import { Briefcase, CalendarBlank, ChatCircle, Chat, Users, ThumbsUp } from '@phosphor-icons/react'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { useScrollReveal } from '@/features/landing/hooks/useScrollReveal'
import { Skel } from './Skel'

interface IconCircleProps {
  icon: PhosphorIcon
  bg: string
  color: string
}

function IconCircle({ icon: Icon, bg, color }: IconCircleProps) {
  return (
    <div
      style={{
        width: '2.875rem',
        height: '2.875rem',
        borderRadius: 8,
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '1.125rem',
        flexShrink: 0,
      }}
    >
      <Icon size="1.375rem" style={{ color }} />
    </div>
  )
}

interface TagProps {
  label: string
  bg: string
  color: string
}

function Tag({ label, bg, color }: TagProps) {
  return (
    <div
      className="uc-feature-tag"
      style={{
        background: bg,
        color,
      }}
    >
      {label}
    </div>
  )
}

export function FeaturesSection() {
  const headerRef = useScrollReveal<HTMLDivElement>()
  const gridRef = useScrollReveal<HTMLDivElement>()

  return (
    <section id="features" className="uc-landing-section">
      <div className="uc-section-shell uc-features-wrap">
        <div ref={headerRef} className="uc-section-header uc-features-header">
          <div className="reveal" data-delay="0">
            <p className="uc-section-eyebrow">Platform stack</p>
            <h2 className="uc-section-title">One system for the campus loops that already exist.</h2>
            <p className="uc-section-copy">
              The product stays platform-first: feed, hiring, messaging, events, and community
              all live inside one verified tenant instead of being scattered across generic tools.
            </p>
          </div>

          <div className="reveal uc-section-aside" data-delay="80">
            <p className="uc-section-aside-label">Coverage</p>
            <p className="uc-section-aside-copy">
              Daily communication, career reach, event logistics, and community operations.
            </p>
          </div>
        </div>

        <div ref={gridRef} className="uc-features-grid">
          <div className="reveal uc-span-2 card-hover-border" data-delay="0" style={{ gridColumn: 'span 2' }}>
            <div className="uc-feature-card">
              <IconCircle icon={ChatCircle} bg="var(--uc-indigo-bg)" color="var(--uc-indigo-l)" />
              <h3 className="uc-feature-title">Social feed</h3>
              <p className="uc-feature-copy">
                Verified campus updates, reactions, comments, and media posts inside one timeline
                that belongs to the university instead of an external social graph.
              </p>
              <Tag label="Must-have" bg="var(--uc-indigo-bg)" color="var(--uc-indigo-l)" />

              <div className="uc-feature-preview">
                <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: '1.75rem',
                      height: '1.75rem',
                      borderRadius: '50%',
                      background: 'var(--uc-indigo)',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3125rem' }}>
                    <Skel w="88%" h={7} />
                    <Skel w="70%" h={7} />
                    <Skel w="48%" h={7} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.4375rem' }}>
                  <div
                    style={{
                      background: 'var(--uc-indigo-bg)',
                      border: '0.5px solid var(--border-default)',
                      borderRadius: 'var(--r-pill)',
                      padding: '0.125rem 0.625rem',
                      fontSize: '0.75rem',
                      color: 'var(--uc-indigo-l)',
                    }}
                  >
                    <ThumbsUp size="0.75rem" weight="bold" /> 18
                  </div>
                  <div
                    style={{
                      background: 'var(--uc-cyan-bg)',
                      border: '0.5px solid var(--border-default)',
                      borderRadius: 'var(--r-pill)',
                      padding: '0.125rem 0.625rem',
                      fontSize: '0.75rem',
                      color: 'var(--uc-cyan)',
                    }}
                  >
                    <ChatCircle size="0.75rem" weight="bold" /> 6
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="reveal card-hover-border" data-delay="80">
            <div className="uc-feature-card">
              <IconCircle icon={Briefcase} bg="var(--uc-mint-bg)" color="var(--uc-mint)" />
              <h3 className="uc-feature-title">Job board</h3>
              <p className="uc-feature-copy">
                Alumni and hiring partners post internships and full-time roles directly into the
                campus network, filtered by university context.
              </p>
              <Tag label="Alumni-powered" bg="var(--uc-mint-bg)" color="var(--uc-mint)" />

              <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4375rem' }}>
                {[
                  { title: 'SWE Intern', company: 'Pathao · Remote', dot: 'var(--uc-mint)' },
                  { title: 'ML Engineer', company: 'bKash · On-site', dot: 'var(--uc-indigo)' },
                ].map(({ title, company, dot }) => (
                  <div
                    key={title}
                    style={{
                      background: 'var(--surface-raised)',
                      border: '0.5px solid var(--border-default)',
                      borderRadius: 8,
                      padding: '0.5rem 0.6875rem',
                      display: 'flex',
                      gap: '0.625rem',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ width: '0.4375rem', height: '0.4375rem', borderRadius: '50%', background: dot, flexShrink: 0 }} />
                    <div>
                      <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                        {title}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                        {company}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="reveal card-hover-border" data-delay="160">
            <div className="uc-feature-card">
              <IconCircle icon={Chat} bg="var(--uc-cyan-bg)" color="var(--uc-cyan)" />
              <h3 className="uc-feature-title">Real-time chat</h3>
              <p className="uc-feature-copy">
                Direct and group messaging stays inside the same verified identity system, so
                conversations, follow-ups, and introductions do not drift into separate apps.
              </p>
              <Tag label="Live" bg="var(--uc-cyan-bg)" color="var(--uc-cyan)" />
            </div>
          </div>

          <div className="reveal card-hover-border" data-delay="240">
            <div className="uc-feature-card">
              <IconCircle icon={CalendarBlank} bg="var(--uc-orange-bg)" color="var(--uc-orange-l)" />
              <h3 className="uc-feature-title">Events</h3>
              <p className="uc-feature-copy">
                Seminars, hackathons, and student programs move through one RSVP flow with
                reminders, campus visibility, and a native place in the product loop.
              </p>
              <Tag label="Campus-wide" bg="var(--uc-orange-bg)" color="var(--uc-orange-l)" />
            </div>
          </div>

          <div className="reveal uc-span-2 card-hover-border" data-delay="320" style={{ gridColumn: 'span 2' }}>
            <div className="uc-feature-card">
              <IconCircle icon={Users} bg="var(--uc-indigo-bg)" color="var(--uc-indigo-xl)" />
              <h3 className="uc-feature-title">Groups & clubs</h3>
              <p className="uc-feature-copy">
                Department circles, clubs, and community threads keep operational updates and
                long-tail campus culture inside the same private tenant.
              </p>
              <Tag label="Community" bg="var(--uc-indigo-bg)" color="var(--uc-indigo-xl)" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
