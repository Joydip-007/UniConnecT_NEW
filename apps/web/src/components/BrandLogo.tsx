import logoSrc from '@/assets/logo.svg'

interface BrandLogoProps {
  height?: number
  ariaLabel?: string
}

const LOGO_ASPECT_RATIO = 1369 / 602

export function BrandLogo({ height = 32, ariaLabel = 'UniConnecT' }: BrandLogoProps) {
  const width = Math.round(height * LOGO_ASPECT_RATIO)

  return (
    <img
      src={logoSrc}
      alt={ariaLabel}
      style={{
        display: 'block',
        flexShrink: 0,
        width,
        height,
        maxWidth: width,
        objectFit: 'contain',
      }}
    />
  )
}
