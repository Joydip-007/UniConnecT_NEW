import { useEffect, useRef } from 'react';
import { ScrollProgressBar } from 'web';

// ScrollProgressBar takes no props — its scaleX comes entirely from
// framer-motion's useScroll() tracking real page scroll. To show a
// non-zero, non-invisible bar in a static capture, the demo scrolls its
// own tall spacer partway on mount before the screenshot is taken.
function Demo() {
  const spacerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    window.scrollTo(0, 400);
  }, []);
  return (
    <div>
      <ScrollProgressBar />
      <div ref={spacerRef} style={{ height: 1200 }} />
    </div>
  );
}

export function Scrolled() {
  return <Demo />;
}
