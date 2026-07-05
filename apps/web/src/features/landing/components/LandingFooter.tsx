import type { CSSProperties, ReactNode, ElementType } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { EnvelopeSimple, MapPin } from '@phosphor-icons/react'

import { BrandLogo } from '@/components/BrandLogo'
import {
  FacebookIcon,
  GitHubIcon,
  InstagramIcon,
  LinkedInIcon,
  XIcon,
} from '@/components/SocialBrandIcons'
import { FooterBackgroundGradient, TextHoverEffect } from '@/components/ui/hover-footer'
import { PATHS } from '@/router/paths'

const HOME_PATH = '/'

const PLATFORM_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Universities', href: '#universities' },
  { label: 'About', href: PATHS.ABOUT },
] as const

const COMMUNITY_LINKS = [
  { label: 'Students', href: '#' },
  { label: 'Alumni', href: '#' },
  { label: 'Faculty', href: '#' },
  { label: 'Admin', href: '#' },
] as const

const LEGAL_LINKS = [
  { label: 'Privacy policy' },
  { label: 'Terms of use' },
  { label: 'Cookie policy' },
] as const

const SOCIAL_LINKS = [
  { icon: LinkedInIcon, label: 'LinkedIn', href: '#' },
  { icon: XIcon, label: 'X/Twitter', href: '#' },
  { icon: FacebookIcon, label: 'Facebook', href: '#' },
  { icon: InstagramIcon, label: 'Instagram', href: '#' },
  { icon: GitHubIcon, label: 'GitHub', href: '#' },
] as const

function SocialLink({
  href,
  icon: Icon,
  label,
}: {
  href: string
  icon: ElementType<any>
  label: string
}) {
  if (href === '#') {
    return (
      <span
        aria-label={label}
        aria-disabled="true"
        className="uc-footer-social-link is-disabled"
      >
        <Icon size="1.0625rem" />
      </span>
    )
  }

  return (
    <a key={label} href={href} aria-label={label} className="uc-footer-social-link">
      <Icon size="1.0625rem" />
    </a>
  )
}

function FooterColumnHeader({ children }: { children: ReactNode }) {
  return <h4 className="uc-footer-column-title">{children}</h4>
}

type FooterLinkProps = {
  children: ReactNode
  href?: string
}

function FooterLink({ children, href }: FooterLinkProps) {
  const location = useLocation()
  const navigate = useNavigate()
  if (!href || href === '#') {
    return (
      <span aria-disabled="true" className="uc-footer-link" style={{ display: 'block' }}>
        {children}
      </span>
    )
  }

  const isHash = href.startsWith('#')
  const sharedStyle = { display: 'block' } as CSSProperties

  if (isHash) {
    return (
      <a
        href={href}
        className="uc-footer-link"
        style={sharedStyle}
        onClick={(event) => {
          event.preventDefault()

          if (location.pathname !== HOME_PATH) {
            navigate(`${HOME_PATH}${href}`)
            return
          }

          const target = document.querySelector(href)
          if (!target) return

          const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
          target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
        }}
      >
        {children}
      </a>
    )
  }

  return (
    <Link to={href} className="uc-footer-link" style={sharedStyle}>
      {children}
    </Link>
  )
}

export function LandingFooter() {
  return (
    <footer className="uc-landing-footer">
      <FooterBackgroundGradient />

      <div className="uc-footer-grid">
        <div className="uc-footer-brand">
          <Link to={HOME_PATH} className="uc-footer-brand-link">
            <BrandLogo height={28} />
          </Link>
          <p className="uc-footer-kicker">UniConnecT</p>
          <p className="uc-footer-copy">
            The private social network built for universities — verified roles, campus
            communities, and real opportunities, all in one place.
          </p>
          <div className="uc-footer-contact-list">
            <a href="mailto:hello@uniconnect.app" className="uc-footer-contact-link">
              <EnvelopeSimple className="uc-footer-contact-icon uc-footer-contact-icon-indigo" size={18} weight="bold" />
              hello@uniconnect.app
            </a>
            <div className="uc-footer-contact-item">
              <MapPin className="uc-footer-contact-icon uc-footer-contact-icon-orange" size={18} weight="bold" />
              UIU Campus, Dhaka, Bangladesh
            </div>
          </div>
        </div>

        <div>
          <FooterColumnHeader>Platform</FooterColumnHeader>
          <nav aria-label="Platform links">
            {PLATFORM_LINKS.map(({ href, label }) => (
              <FooterLink key={label} href={href}>
                {label}
              </FooterLink>
            ))}
          </nav>
        </div>

        <div>
          <FooterColumnHeader>Community</FooterColumnHeader>
          <nav aria-label="Community links">
            {COMMUNITY_LINKS.map(({ href, label }) => (
              <FooterLink key={label} href={href}>
                {label}
              </FooterLink>
            ))}
          </nav>
        </div>

        <div>
          <FooterColumnHeader>Legal</FooterColumnHeader>
          <nav aria-label="Legal links">
            {LEGAL_LINKS.map(({ label }) => (
              <FooterLink key={label}>
                {label}
              </FooterLink>
            ))}
          </nav>
          <div className="uc-footer-pill">
            <span className="uc-footer-pill-dot" />
            UIU · Dhaka · 2026
          </div>
        </div>
      </div>

      <div className="uc-footer-bottom">
        <div className="uc-footer-bottom-bar">
          <div className="uc-footer-socials">
            {SOCIAL_LINKS.map(({ href, icon: Icon, label }) => (
              <SocialLink key={label} href={href} icon={Icon} label={label} />
            ))}
          </div>
          <p className="uc-footer-copyright">© 2026 Team Mavericks · UIU · Bangladesh</p>
        </div>
      </div>

      <div className="uc-footer-hover-text">
        <TextHoverEffect text="UniConnecT" />
      </div>
    </footer>
  )
}
