import { lazy, Suspense, type CSSProperties } from 'react'

const Lottie = lazy(() => import('lottie-react'))

interface AnimatedIconProps {
  animationData: object
  size?: number
  loop?: boolean | number
  autoplay?: boolean
  ariaLabel?: string
  style?: CSSProperties
}

export function AnimatedIcon({
  animationData,
  size = 16,
  loop = true,
  autoplay = true,
  ariaLabel,
  style,
}: AnimatedIconProps) {
  return (
    <span
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      role={ariaLabel ? 'img' : undefined}
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        lineHeight: 0,
        pointerEvents: 'none',
        ...style,
      }}
    >
      <Suspense fallback={null}>
        <Lottie
          animationData={animationData}
          loop={loop}
          autoplay={autoplay}
          style={{ width: size, height: size }}
        />
      </Suspense>
    </span>
  )
}
