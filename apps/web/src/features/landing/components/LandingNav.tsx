import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BrandLogo } from '@/components/BrandLogo'
import { GhostBtn, OrangeBtn } from '@/components/Button'
import { ThemeToggleButton } from '@/components/ThemeToggleButton'
import { PATHS } from '@/router/paths'

const NAV_LINKS = [
  { label: 'Features',     href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Universities', href: '#universities' },
  { label: 'About',        href: '#about' },
  { label: 'Pricing',      href: '#pricing' },
]

export function LandingNav() {
  const navRef   = useRef<HTMLElement>(null)
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      if (!navRef.current) return
      if (window.scrollY > 20) {
        navRef.current.classList.add('nav-scrolled')
      } else {
        navRef.current.classList.remove('nav-scrolled')
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  /* Smooth-scroll to in-page anchors; honor prefers-reduced-motion. */
  function handleLinkClick(href: string) {
    setMenuOpen(false)
    const target = document.querySelector(href)
    if (!target) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <>
      <nav
        ref={navRef}
        className="uc-landing-nav"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          height: 66,
          display: 'flex',
          alignItems: 'center',
          padding: '0 52px',
          gap: 36,
          background: 'var(--surface-card)',
          borderBottom: '0.5px solid var(--border-default)',
        }}
      >
        {/* Logo */}
        <a
          href="/"
          style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }}
        >
          <BrandLogo height={34} />
        </a>

        {/* Center nav links — hidden on mobile via CSS */}
        <div className="uc-nav-center-links" style={{ display: 'flex', gap: 26, marginLeft: 'auto', marginRight: 'auto' }}>
          {NAV_LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              onClick={(e) => { e.preventDefault(); handleLinkClick(href) }}
              className="nav-link-hover"
              style={{
                fontSize: 14,
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                transition: 'color 150ms ease',
              }}
            >
              {label}
            </a>
          ))}
        </div>

        {/* Right CTAs */}
        <div style={{ display: 'flex', gap: 10, flexShrink: 0, marginLeft: 'auto', alignItems: 'center' }}>
          <ThemeToggleButton size={36} />
          <GhostBtn onClick={() => navigate(PATHS.LOGIN)}>Sign in</GhostBtn>
          <OrangeBtn onClick={() => navigate(PATHS.REGISTER.replace(':token', 'invite'))}>
            Join free
          </OrangeBtn>
        </div>

        {/* Hamburger — visible on mobile via CSS */}
        <button
          className={`uc-nav-hamburger${menuOpen ? ' open' : ''}`}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </nav>

      {/* Mobile drawer */}
      <div className={`uc-nav-mobile-drawer${menuOpen ? ' open' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0 12px' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Theme</span>
          <ThemeToggleButton size={32} />
        </div>
        {NAV_LINKS.map(({ label, href }) => (
          <a
            key={label}
            href={href}
            onClick={(e) => { e.preventDefault(); handleLinkClick(href) }}
            style={{
              fontSize: 15,
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              padding: '10px 4px',
              borderBottom: '0.5px solid var(--border-default)',
              transition: 'color 0.2s',
            }}
          >
            {label}
          </a>
        ))}
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <GhostBtn style={{ flex: 1 }} onClick={() => { setMenuOpen(false); navigate(PATHS.LOGIN) }}>
            Sign in
          </GhostBtn>
          <OrangeBtn
            style={{ flex: 1 }}
            onClick={() => { setMenuOpen(false); navigate(PATHS.REGISTER.replace(':token', 'invite')) }}
          >
            Join free
          </OrangeBtn>
        </div>
      </div>
    </>
  )
}
