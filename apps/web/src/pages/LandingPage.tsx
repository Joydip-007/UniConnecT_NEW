import '@/styles/landing.css'
import { LandingNav } from '@/features/landing/components/LandingNav'
import { HeroSection } from '@/features/landing/components/HeroSection'
import { TickerStrip } from '@/features/landing/components/TickerStrip'
import { StatsSection } from '@/features/landing/components/StatsSection'
import { FeaturesSection } from '@/features/landing/components/FeaturesSection'
import { HowItWorks } from '@/features/landing/components/HowItWorks'
import { UniversitiesSection } from '@/features/landing/components/UniversitiesSection'
import { TestimonialsSection } from '@/features/landing/components/TestimonialsSection'
import { PricingSection } from '@/features/landing/components/PricingSection'
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
      <header>
        <LandingNav />
      </header>
      <main>
        <HeroSection />
        <TickerStrip />
        <StatsSection />
        <FeaturesSection />
        <HowItWorks />
        <UniversitiesSection />
        <TestimonialsSection />
        <PricingSection />
        <CtaSection />
      </main>
      <LandingFooter />
    </div>
  )
}
