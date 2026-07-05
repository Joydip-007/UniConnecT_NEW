import '@/styles/landing.css'
import { LandingNav } from '@/features/landing/components/LandingNav'
import { AboutStory } from '@/features/landing/components/AboutStory'
import { LandingFooter } from '@/features/landing/components/LandingFooter'

export function AboutPage() {
  return (
    <div style={{ background: 'var(--surface-page)', overflowX: 'hidden', minHeight: '100dvh' }}>
      <header>
        <LandingNav />
      </header>
      <main>
        <AboutStory />
      </main>
      <LandingFooter />
    </div>
  )
}
