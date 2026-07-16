import { GlobalCurtain } from 'web';

// GlobalCurtain reads the themeStore's `phase`/`targetColor`. In its default
// idle state (phase === 'idle') it renders a fixed, fully transparent,
// scaleY(0) overlay — i.e. invisible, which is correct: it's a fullscreen
// transition curtain that only becomes visible while a theme switch is
// animating ('falling' phase). We render it alongside a labeled backdrop so
// the (empty) result is still visually confirmable in the preview.
export function Default() {
  return (
    <div
      style={{
        padding: 24,
        minHeight: 240,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        color: 'var(--text-secondary)',
        fontSize: 13,
      }}
    >
      GlobalCurtain is mounted here (idle phase — invisible by design; it only
      animates during a theme toggle).
      <GlobalCurtain />
    </div>
  );
}
