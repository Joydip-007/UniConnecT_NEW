import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BrandLogo } from '@/components/BrandLogo'
import { GhostBtn, OrangeBtn } from '@/components/Button'
import { ThemeToggleButton } from '@/components/ThemeToggleButton'
import { PATHS } from '@/router/paths'

const HOME_PATH = '/'

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Universities', href: '#universities' },
  { label: 'About', href: PATHS.ABOUT },
  { label: 'Pricing', href: '#pricing' },
] as const

export function LandingNav() {
  const navRef = useRef<HTMLElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      if (!navRef.current) return
      navRef.current.classList.toggle('nav-scrolled', window.scrollY > 12)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

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
          <span className="uc-nav-brand-copy">
            <span className="uc-nav-brand-kicker">UniConnecT</span>
            <span className="uc-nav-brand-note">Private campus network</span>
          </span>
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
              className="nav-link-hover uc-nav-link"
            >
              {label}
            </a>
          ))}
        </div>

        <div className="uc-nav-actions">
          <ThemeToggleButton size={36} />
          <GhostBtn onClick={() => navigate(PATHS.LOGIN)}>Sign in</GhostBtn>
          <OrangeBtn onClick={() => navigate(PATHS.REGISTER.replace(':token', 'invite'))}>
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
            <p className="uc-nav-mobile-kicker">Public route</p>
            <p className="uc-nav-mobile-note">Landing and about share the same chrome.</p>
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
          <GhostBtn style={{ flex: 1 }} onClick={() => navigate(PATHS.LOGIN)}>
            Sign in
          </GhostBtn>
          <OrangeBtn
            style={{ flex: 1 }}
            onClick={() => navigate(PATHS.REGISTER.replace(':token', 'invite'))}
          >
            Join free
          </OrangeBtn>
        </div>
      </div>
    </>
  )
}
