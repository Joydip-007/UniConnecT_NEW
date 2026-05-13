import '@/styles/landing.css'
import { LandingNav } from '@/features/landing/components/LandingNav'
import { HeroSection } from '@/features/landing/components/HeroSection'
import { TickerStrip } from '@/features/landing/components/TickerStrip'
import { StatsSection } from '@/features/landing/components/StatsSection'
import { FeaturesSection } from '@/features/landing/components/FeaturesSection'
import { HowItWorks } from '@/features/landing/components/HowItWorks'
import { TestimonialsSection } from '@/features/landing/components/TestimonialsSection'
import { CtaSection } from '@/features/landing/components/CtaSection'
import { LandingFooter } from '@/features/landing/components/LandingFooter'

export default function LandingPage() {
  return (
    <div
      style={{
        background: 'var(--surface-page)',
        overflowX: 'hidden',
        minHeight: '100dvh',
      }}
    >
      <LandingNav />
      <HeroSection />
      <TickerStrip />
      <StatsSection />
      <FeaturesSection />
      <HowItWorks />
      <TestimonialsSection />
      <CtaSection />
      <LandingFooter />
    </div>
  )
}
