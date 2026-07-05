import { useNavigate } from 'react-router-dom'
import { GhostBtn, OrangeBtn } from '@/components/Button'
import { useScrollReveal } from '@/features/landing/hooks/useScrollReveal'
import { PATHS } from '@/router/paths'

export function CtaSection() {
  const navigate = useNavigate()
  const cardRef = useScrollReveal<HTMLDivElement>()
  const scrollToUniversities = () => {
    const target = document.querySelector('#universities')
    if (!target) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <section id="contact" className="uc-cta-section">
      <div ref={cardRef}>
        <div className="reveal uc-cta-card" data-delay="0">
          <div className="uc-cta-layout">
            <div className="uc-cta-copy-block">
              <div className="uc-cta-pill">Join UniConnecT, always free for students</div>
              <h2 className="uc-cta-title">Ready to reconnect your campus?</h2>
              <p className="uc-cta-copy">
                Bring students, alumni, faculty, and staff onto one private, university-verified
                network built for the way campus communication already works.
              </p>
            </div>

            <div className="uc-cta-actions">
              <OrangeBtn
                style={{ padding: '0.6875rem 1.75rem', fontSize: '0.9375rem' }}
                onClick={() => navigate(PATHS.REGISTER.replace(':token', 'invite'))}
              >
                Get started free
              </OrangeBtn>
              <GhostBtn
                style={{ padding: '0.6875rem 1.5rem', fontSize: '0.9375rem' }}
                onClick={scrollToUniversities}
              >
                For universities
              </GhostBtn>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
