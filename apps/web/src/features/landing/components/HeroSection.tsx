import { Rocket, Play, Briefcase, MessageSquare, Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { OrangeBtn, GhostBtn } from '@/components/Button'
import { PATHS } from '@/router/paths'
import { useScrollReveal } from '@/features/landing/hooks/useScrollReveal'

function Skel({ w, h = 8 }: { w: number | string; h?: number }) {
  return (
    <div
      style={{
        height: h,
        borderRadius: 4,
        background: 'var(--border-strong)',
        width: w,
        flexShrink: 0,
      }}
    />
  )
}

export function HeroSection() {
  const navigate  = useNavigate()
  // threshold: 0 → fires immediately since section is above the fold
  const leftRef = useScrollReveal<HTMLDivElement>(0)

  return (
    <section style={{ position: 'relative', overflow: 'hidden' }}>
      <div
        className="uc-hero-grid"
        style={{
          maxWidth: 1240,
          margin: '0 auto',
          minHeight: '90vh',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 56,
          alignItems: 'center',
          padding: '80px 52px 60px',
          position: 'relative',
        }}
      >
        {/* Background — dot grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(rgba(91,91,214,.18) 1.5px, transparent 1.5px)',
            backgroundSize: '30px 30px',
            maskImage: 'radial-gradient(ellipse 70% 90% at 30% 50%, black 20%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 90% at 30% 50%, black 20%, transparent 80%)',
            pointerEvents: 'none',
          }}
        />

        {/* Background — orange orb */}
        <div
          style={{
            position: 'absolute',
            width: 520,
            height: 520,
            borderRadius: '50%',
            top: -80,
            right: -60,
            background: 'radial-gradient(circle, rgba(240,90,40,.14) 0%, transparent 65%)',
            pointerEvents: 'none',
          }}
        />

        {/* Background — indigo orb */}
        <div
          style={{
            position: 'absolute',
            width: 700,
            height: 700,
            borderRadius: '50%',
            bottom: -280,
            left: -160,
            background: 'radial-gradient(circle, rgba(91,91,214,.09) 0%, transparent 60%)',
            pointerEvents: 'none',
          }}
        />

        {/* ── LEFT COLUMN ── */}
        <div
          ref={leftRef}
          style={{
            zIndex: 1,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: 28,
          }}
        >
          {/* Badge */}
          <div
            className="reveal"
            data-delay="0"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              alignSelf: 'flex-start',
              background: 'var(--surface-raised)',
              border: '0.5px solid rgba(91,91,214,.45)',
              borderRadius: 999,
              padding: '6px 16px 6px 8px',
            }}
          >
            <span className="hero-pulse-dot" />
            <span style={{ fontSize: 12, color: 'var(--uc-indigo-xl)' }}>
              Now live at UIU · Dhaka, Bangladesh
            </span>
          </div>

          {/* H1 — font-weight 800 is intentional (hero headline exception) */}
          <h1
            className="reveal"
            data-delay="100"
            style={{
              margin: 0,
              fontSize: 'clamp(44px, 6vw, 68px)',
              fontWeight: 800,
              lineHeight: 1.07,
              letterSpacing: '-2.5px',
            }}
          >
            <span style={{ color: 'var(--text-primary)' }}>Your campus.</span>
            <br />
            <span style={{ color: 'var(--uc-orange)' }}>One place.</span>
          </h1>

          {/* Subtitle */}
          <p
            className="reveal"
            data-delay="200"
            style={{
              margin: 0,
              fontSize: 17,
              lineHeight: 1.78,
              color: 'var(--text-secondary)',
              maxWidth: 450,
            }}
          >
            UniConnecT is the private social network built for universities — connecting students,
            alumni, faculty, and staff with a feed, jobs, real-time chat, and campus tools, all in
            one place.
          </p>

          {/* CTA row */}
          <div
            className="reveal"
            data-delay="300"
            style={{ display: 'flex', gap: 13, flexWrap: 'wrap' }}
          >
            <OrangeBtn
              style={{ padding: '11px 24px', fontSize: 15, gap: 9 }}
              onClick={() => navigate(PATHS.LOGIN)}
            >
              <Rocket size={16} />
              Get started free
            </OrangeBtn>
            <GhostBtn style={{ padding: '11px 22px', fontSize: 15, gap: 9 }}>
              <Play size={16} />
              Watch demo
            </GhostBtn>
          </div>

          {/* Social proof */}
          <div
            className="reveal"
            data-delay="400"
            style={{ display: 'flex', gap: 14, alignItems: 'center' }}
          >
            {/* Overlapping avatars */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {(
                [
                  { initials: 'JD', color: 'var(--uc-indigo)', ml: 0 },
                  { initials: 'SF', color: 'var(--uc-orange)', ml: -9 },
                  { initials: 'MH', color: 'var(--uc-cyan)',   ml: -9 },
                  { initials: 'MA', color: 'var(--uc-mint)',   ml: -9 },
                ] as const
              ).map(({ initials, color, ml }) => (
                <div
                  key={initials}
                  style={{
                    width: 33,
                    height: 33,
                    borderRadius: '50%',
                    background: color,
                    border: '2.5px solid var(--surface-page)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'white',
                    marginLeft: ml,
                    flexShrink: 0,
                  }}
                >
                  {initials}
                </div>
              ))}
            </div>

            <div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                Team Mavericks is building this for UIU
              </p>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.45 }}>
                the first campus social network in South Asia
              </p>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="hero-col-right uc-hero-right" style={{ position: 'relative', height: 530 }}>

          {/* Phone centering wrapper — float animation on inner frame avoids transform conflict */}
          <div
            style={{
              position: 'absolute',
              right: 16,
              top: '50%',
              transform: 'translateY(-50%)',
            }}
          >
            <div
              className="phone-float"
              style={{
                width: 218,
                background: 'var(--surface-card)',
                border: '1.5px solid var(--border-hover)',
                borderRadius: 34,
                boxShadow: '0 32px 80px rgba(0,0,0,.45)',
                overflow: 'hidden',
              }}
            >
              {/* Notch */}
              <div
                style={{
                  width: 62,
                  height: 20,
                  background: 'var(--surface-page)',
                  borderRadius: '0 0 16px 16px',
                  margin: '0 auto 14px',
                }}
              />

              {/* Inner content */}
              <div
                style={{
                  padding: '0 14px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 9,
                }}
              >
                {/* Top bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--uc-orange)', flexShrink: 0 }} />
                  <div style={{ flex: 1, height: 9, borderRadius: 4, background: 'var(--border-default)' }} />
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--surface-raised)', flexShrink: 0 }} />
                </div>

                <div style={{ height: '0.5px', background: 'var(--border-default)' }} />

                {/* Mini post 1 */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--uc-indigo)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 500, color: 'white', flexShrink: 0 }}>JD</div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <Skel w="100%" />
                    <Skel w="82%" />
                    <Skel w="58%" />
                    <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                      <div style={{ background: 'var(--uc-indigo-bg)', border: '0.5px solid var(--uc-indigo-bdr)', borderRadius: 999, padding: '2px 8px', fontSize: 9, color: 'var(--uc-indigo-l)' }}>👍 4</div>
                      <div style={{ background: 'var(--uc-cyan-bg)', border: '0.5px solid rgba(6,182,212,.28)', borderRadius: 999, padding: '2px 8px', fontSize: 9, color: 'var(--uc-cyan)' }}>💬 2</div>
                    </div>
                  </div>
                </div>

                <div style={{ height: '0.5px', background: 'var(--border-default)' }} />

                {/* Mini post 2 */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--uc-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 500, color: 'white', flexShrink: 0 }}>SF</div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ background: 'var(--uc-mint-bg)', border: '0.5px solid rgba(16,185,129,.28)', borderRadius: 6, padding: '5px 7px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <Skel w="90%" h={7} />
                      <Skel w="65%" h={6} />
                    </div>
                    <div style={{ alignSelf: 'flex-start', background: 'var(--uc-orange-bg)', border: '0.5px solid var(--uc-orange-bdr)', borderRadius: 999, padding: '2px 9px', fontSize: 9, color: 'var(--uc-orange-l)' }}>Apply →</div>
                  </div>
                </div>

                {/* Notification row */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--uc-indigo-bg)', border: '0.5px solid var(--uc-indigo-bdr)', borderRadius: 8, padding: '7px 10px' }}>
                  <Bell size={12} style={{ color: 'var(--uc-indigo-l)', flexShrink: 0 }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <Skel w="80%" h={7} />
                    <Skel w="55%" h={6} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Floating card 1 — Job */}
          <div
            style={{
              position: 'absolute', left: 0, top: 48, width: 188,
              background: 'var(--surface-raised)', border: '0.5px solid var(--border-hover)',
              borderRadius: 14, padding: '13px 15px',
              animation: 'floatAlt 4.8s ease-in-out infinite',
            }}
          >
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--uc-mint-bg)', border: '0.5px solid rgba(16,185,129,.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Briefcase size={14} style={{ color: 'var(--uc-mint)' }} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>SWE Intern</p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.3 }}>Pathao · Remote</p>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <div style={{ background: 'var(--uc-mint-bg)', border: '0.5px solid rgba(16,185,129,.28)', borderRadius: 999, padding: '2px 8px', fontSize: 10, color: 'var(--uc-mint)' }}>New</div>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>by alumni</span>
            </div>
          </div>

          {/* Floating card 2 — Mentorship */}
          <div
            style={{
              position: 'absolute', left: 14, bottom: 64, width: 178,
              background: 'var(--surface-raised)', border: '0.5px solid var(--border-hover)',
              borderRadius: 14, padding: '13px 15px',
              display: 'flex', gap: 10, alignItems: 'center',
              animation: 'uc-float 4s 0.6s ease-in-out infinite',
            }}
          >
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--uc-indigo)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, color: 'white', flexShrink: 0 }}>MH</div>
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.35 }}>Mentorship accepted</p>
              <p style={{ margin: 0, fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.35 }}>Monnabur · Alumni '21</p>
            </div>
          </div>

          {/* Floating card 3 — Live chat */}
          <div
            style={{
              position: 'absolute', right: 4, bottom: 32, width: 155,
              background: 'var(--surface-raised)', border: '0.5px solid var(--border-hover)',
              borderRadius: 14, padding: '13px 15px',
              animation: 'floatAlt 5.2s 1.2s ease-in-out infinite',
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--uc-cyan-bg)', border: '0.5px solid rgba(6,182,212,.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <MessageSquare size={14} style={{ color: 'var(--uc-cyan)' }} />
              </div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>Live chat</p>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
              <span className="online-dot" />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>247 online</span>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
