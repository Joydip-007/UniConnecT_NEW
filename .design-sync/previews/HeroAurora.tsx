import { useRef } from 'react';
import { HeroAurora } from 'web';

function Demo() {
  const hostRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={hostRef}
      style={{
        position: 'relative',
        height: 320,
        width: '100%',
        overflow: 'hidden',
        borderRadius: 'var(--r-lg)',
        background: 'var(--surface-page)',
      }}
    >
      <HeroAurora hostRef={hostRef} active />
    </div>
  );
}

export function Active() {
  return <Demo />;
}
