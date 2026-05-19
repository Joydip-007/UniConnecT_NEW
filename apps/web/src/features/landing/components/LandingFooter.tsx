import { Link } from 'react-router-dom'
import { Mail, MapPin } from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'
import {
  LinkedInIcon,
  XIcon,
  FacebookIcon,
  InstagramIcon,
  GitHubIcon,
} from '@/components/SocialBrandIcons'
import {
  TextHoverEffect,
  FooterBackgroundGradient,
} from '@/components/ui/hover-footer'

const PLATFORM_LINKS = [
  { label: 'Features',     href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Universities', href: '#universities' },
  { label: 'Testimonials', href: '#testimonials' },
]

const COMMUNITY_LINKS = [
  { label: 'Students',   href: '#' },
  { label: 'Alumni',     href: '#' },
  { label: 'Faculty',    href: '#' },
  { label: 'Admin',      href: '#' },
]

const LEGAL_LINKS = [
  { label: 'Privacy policy', href: '#privacy' },
  { label: 'Terms of use',   href: '#terms' },
  { label: 'Cookie policy',  href: '#cookies' },
]

const SOCIAL_LINKS = [
  { icon: LinkedInIcon,  label: 'LinkedIn',  href: '#' },
  { icon: XIcon,         label: 'X/Twitter', href: '#' },
  { icon: FacebookIcon,  label: 'Facebook',  href: '#' },
  { icon: InstagramIcon, label: 'Instagram', href: '#' },
  { icon: GitHubIcon,    label: 'GitHub',    href: '#' },
]

function FooterColumnHeader({ children }: { children: React.ReactNode }) {
  return (
    <h4
      style={{
        margin: '0 0 20px',
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--text-secondary)',
      }}
    >
      {children}
    </h4>
  )
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const isAnchor = href.startsWith('#')
  const sharedStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 14,
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    lineHeight: 1,
    padding: '7px 0',
    transition: 'color 0.18s var(--ease-out-strong)',
  }
  const handlers = {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.color = 'var(--text-primary)'
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.color = 'var(--text-secondary)'
    },
  }
  if (isAnchor) {
    return (
      <a href={href} style={sharedStyle} {...handlers}>
        {children}
      </a>
    )
  }
  return (
    <Link to={href} style={sharedStyle} {...handlers}>
      {children}
    </Link>
  )
}

export function LandingFooter() {
  return (
    <footer
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderTop: '0.5px solid var(--border-default)',
        background: 'var(--surface-page)',
      }}
    >
      <FooterBackgroundGradient />

      {/* Main grid */}
      <div
        className="uc-footer-grid"
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 1240,
          margin: '0 auto',
          padding: '72px 52px 48px',
          display: 'grid',
          gridTemplateColumns: '1.6fr 1fr 1fr 1.2fr',
          gap: '0 48px',
        }}
      >
        {/* ── Col 1: Brand ── */}
        <div style={{ paddingRight: 24 }}>
          <Link to="/" style={{ display: 'inline-block', textDecoration: 'none', marginBottom: 20 }}>
            <BrandLogo height={28} />
          </Link>
          <p
            style={{
              margin: '0 0 28px',
              fontSize: 14,
              lineHeight: 1.7,
              color: 'var(--text-secondary)',
              maxWidth: 280,
            }}
          >
            The private social network built for universities — verified roles, campus
            communities, and real opportunities, all in one place.
          </p>

          {/* Contact items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <a
              href="mailto:hello@uniconnect.app"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 13,
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                transition: 'color 0.18s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--uc-indigo-l)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
            >
              <Mail size={15} style={{ color: 'var(--uc-indigo)', flexShrink: 0 }} />
              hello@uniconnect.app
            </a>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 13,
                color: 'var(--text-secondary)',
              }}
            >
              <MapPin size={15} style={{ color: 'var(--uc-orange)', flexShrink: 0 }} />
              UIU Campus, Dhaka, Bangladesh
            </span>
          </div>
        </div>

        {/* ── Col 2: Platform ── */}
        <div>
          <FooterColumnHeader>Platform</FooterColumnHeader>
          <nav aria-label="Platform links">
            {PLATFORM_LINKS.map(({ label, href }) => (
              <FooterLink key={label} href={href}>{label}</FooterLink>
            ))}
          </nav>
        </div>

        {/* ── Col 3: Community ── */}
        <div>
          <FooterColumnHeader>Community</FooterColumnHeader>
          <nav aria-label="Community links">
            {COMMUNITY_LINKS.map(({ label, href }) => (
              <FooterLink key={label} href={href}>{label}</FooterLink>
            ))}
          </nav>
        </div>

        {/* ── Col 4: Legal ── */}
        <div>
          <FooterColumnHeader>Legal</FooterColumnHeader>
          <nav aria-label="Legal links">
            {LEGAL_LINKS.map(({ label, href }) => (
              <FooterLink key={label} href={href}>{label}</FooterLink>
            ))}
          </nav>

          {/* UIU pill */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              marginTop: 28,
              background: 'var(--uc-orange-bg)',
              border: '0.5px solid var(--uc-orange-bdr)',
              borderRadius: 'var(--r-pill)',
              padding: '5px 14px',
              fontSize: 12,
              color: 'var(--uc-orange)',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--uc-orange)',
                display: 'inline-block',
                animation: 'uc-pulse 2s ease-in-out infinite',
              }}
            />
            UIU · Dhaka · 2026
          </div>
        </div>
      </div>

      {/* Divider + bottom bar */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 1240,
          margin: '0 auto',
          padding: '0 52px 32px',
        }}
      >
        <div
          style={{
            borderTop: '0.5px solid var(--border-default)',
            paddingTop: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          {/* Social icons */}
          <div style={{ display: 'flex', gap: 4 }}>
            {SOCIAL_LINKS.map(({ icon: Icon, label, href }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 40,
                  height: 40,
                  borderRadius: 'var(--r-md)',
                  color: 'var(--text-tertiary)',
                  transition: 'color 0.18s var(--ease-out-strong), background 0.18s var(--ease-out-strong)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--text-primary)'
                  e.currentTarget.style.background = 'var(--surface-hover)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-tertiary)'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <Icon size={17} />
              </a>
            ))}
          </div>

          {/* Copyright */}
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>
            © 2026 Team Mavericks · UIU · Bangladesh
          </p>
        </div>
      </div>

      {/* Text hover effect — desktop only. pointerEvents none so the bottom bar's
          social icons remain clickable despite this div overlapping them. The SVG
          tracks the cursor via a document-level mousemove listener instead. */}
      <div
        className="uc-footer-hover-text"
        style={{
          position: 'relative',
          zIndex: 1,
          height: '14rem',
          marginTop: '-9rem',
          marginBottom: '-5rem',
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <TextHoverEffect text="UniConnecT" />
      </div>

      <style>{`
        @keyframes uc-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        @media (max-width: 900px) {
          .uc-footer-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 40px 32px !important;
          }
          .uc-footer-hover-text {
            display: none;
          }
        }
        @media (max-width: 560px) {
          .uc-footer-grid {
            grid-template-columns: 1fr !important;
            padding: 48px 24px 32px !important;
          }
        }
      `}</style>
    </footer>
  )
}
