import { lazy, Suspense, useEffect, useRef, type CSSProperties } from 'react'
import type { LottieRefCurrentProps } from 'lottie-react'

const Lottie = lazy(() => import('lottie-react'))

interface AnimatedIconProps {
  animationData: object
  size?: number
  loop?: boolean | number
  autoplay?: boolean
  playKey?: string | number
  ariaLabel?: string
  className?: string
  style?: CSSProperties
  useCurrentColor?: boolean
}

export function AnimatedIcon({
  animationData,
  size = 16,
  loop = false,
  autoplay = false,
  playKey,
  ariaLabel,
  className,
  style,
  useCurrentColor = true,
}: AnimatedIconProps) {
  const lottieRef = useRef<LottieRefCurrentProps | null>(null)
  const lastPlayKeyRef = useRef(playKey)
  const pendingPlayRef = useRef(false)

  useEffect(() => {
    if (playKey === undefined || Object.is(playKey, lastPlayKeyRef.current)) return

    lastPlayKeyRef.current = playKey
    if (lottieRef.current?.animationLoaded) {
      lottieRef.current.goToAndPlay(0, true)
      return
    }

    pendingPlayRef.current = true
  }, [playKey])

  function handleDOMLoaded() {
    if (!autoplay) {
      lottieRef.current?.goToAndStop(0, true)
    }

    if (pendingPlayRef.current) {
      pendingPlayRef.current = false
      lottieRef.current?.goToAndPlay(0, true)
    }
  }

  return (
    <span
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      className={[
        'animated-icon',
        useCurrentColor ? 'animated-icon-current-color' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
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
          lottieRef={lottieRef}
          onDOMLoaded={handleDOMLoaded}
          style={{ width: size, height: size }}
        />
      </Suspense>
    </span>
  )
}
