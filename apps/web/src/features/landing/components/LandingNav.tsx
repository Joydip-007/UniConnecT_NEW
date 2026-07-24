import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useScroll, useMotionValueEvent } from 'framer-motion'
import { BrandLogo } from '@/components/BrandLogo'
import { GhostBtn, OrangeBtn } from '@/components/Button'
import { ThemeToggleButton } from '@/components/ThemeToggleButton'
import { PATHS } from '@/router/paths'
import { useScrollSpy } from '@/features/landing/hooks/useScrollSpy'

const HOME_PATH = '/'

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Universities', href: '#universities' },
  { label: 'Pricing', href: '#pricing' },
] as const

const SPY_SECTION_IDS = ['features', 'how-it-works', 'universities', 'pricing']

export function LandingNav() {
  const navRef = useRef<HTMLElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const activeSection = useScrollSpy(SPY_SECTION_IDS)

  const { scrollY } = useScroll()

  useMotionValueEvent(scrollY, 'change', (latest) => {
    if (!navRef.current) return
    navRef.current.classList.toggle('nav-scrolled', latest > 12)
  })

  // Ensure initial state is set
  useEffect(() => {
    if (!navRef.current) return
    navRef.current.classList.toggle('nav-scrolled', scrollY.get() > 12)
  }, [scrollY])

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (location.pathname !== HOME_PATH || !location.hash) return

    let frame = 0
    let attempts = 0

    const scrollToHash = () => {
      attempts += 1
      const target = document.querySelector(location.hash)
      if (target) {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
        return
      }

      if (attempts < 8) {
        frame = requestAnimationFrame(scrollToHash)
      }
    }

    frame = requestAnimationFrame(scrollToHash)
    return () => {
      if (frame) cancelAnimationFrame(frame)
    }
  }, [location.hash, location.pathname])

  function handleLinkClick(href: string) {
    setMenuOpen(false)

    if (!href.startsWith('#')) {
      navigate(href)
      return
    }

    if (location.pathname !== HOME_PATH) {
      navigate(`${HOME_PATH}${href}`)
      return
    }

    const target = document.querySelector(href)
    if (!target) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <>
      <nav ref={navRef} className="uc-landing-nav">
        <Link to={HOME_PATH} className="uc-nav-brand" aria-label="UniConnecT home">
          <BrandLogo height={34} />
        </Link>

        <div className="uc-nav-center-links">
          {NAV_LINKS.map(({ href, label }) => (
            <a
              key={label}
              href={href}
              onClick={(event) => {
                event.preventDefault()
                handleLinkClick(href)
              }}
              className={`nav-link-hover uc-nav-link${href === `#${activeSection}` ? ' is-active' : ''}`}
            >
              {label}
            </a>
          ))}
        </div>

        <div className="uc-nav-actions">
          <ThemeToggleButton size={36} />
          <GhostBtn onClick={() => navigate(PATHS.LOGIN)} aria-label="Sign in to your account">Sign in</GhostBtn>
          <OrangeBtn onClick={() => navigate(PATHS.REGISTER.replace(':token', 'invite'))} aria-label="Create a free account">
            Join free
          </OrangeBtn>
        </div>

        <button
          type="button"
          className={`uc-nav-hamburger${menuOpen ? ' open' : ''}`}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="uc-nav-mobile-drawer"
          onClick={() => setMenuOpen((value) => !value)}
        >
          <span />
          <span />
          <span />
        </button>
      </nav>

      <div
        id="uc-nav-mobile-drawer"
        className={`uc-nav-mobile-drawer${menuOpen ? ' open' : ''}`}
      >
        <div className="uc-nav-mobile-header">
          <div>
            <p className="uc-nav-mobile-kicker">UniConnecT</p>
            <p className="uc-nav-mobile-note">
              A private network for campus life, built to feel familiar from the first visit.
            </p>
          </div>
          <ThemeToggleButton size={32} />
        </div>
        {NAV_LINKS.map(({ href, label }) => (
          <a
            key={label}
            href={href}
            onClick={(event) => {
              event.preventDefault()
              handleLinkClick(href)
            }}
            className="uc-nav-mobile-link"
          >
            {label}
          </a>
        ))}
        <div className="uc-nav-mobile-actions">
          <GhostBtn style={{ flex: 1 }} onClick={() => navigate(PATHS.LOGIN)} aria-label="Sign in to your account">
            Sign in
          </GhostBtn>
          <OrangeBtn
            style={{ flex: 1 }}
            onClick={() => navigate(PATHS.REGISTER.replace(':token', 'invite'))}
            aria-label="Create a free account"
          >
            Join free
          </OrangeBtn>
        </div>
      </div>
    </>
  )
}
