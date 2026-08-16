import { UserActionsMenu } from 'web';

// The menu's open state is internal (`useState`), with no prop to force it and a
// hardcoded framer-motion `initial={{opacity:0}}` that the reduced-motion shim
// cannot reach — same shape as the documented ReactionsDialog case. So the story
// is the component's real resting state, placed in the profile row it ships in
// rather than floating alone on the page.

function ProfileRow({ name, meta, muted }: { name: string; meta: string; muted: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 14,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'var(--surface-raised)',
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{meta}</div>
      </div>
      <UserActionsMenu userId="u-1" userName={name} isMuted={muted} />
    </div>
  );
}

export function OnAProfileRow() {
  return (
    <div style={{ padding: 16, background: 'var(--surface-page)', width: 420 }}>
      <ProfileRow name="Tanvir Ahmed" meta="CSE · Batch 2026" muted={false} />
    </div>
  );
}

// ONE story only, deliberately. Two things were tried and both failed:
//  - An `isMuted` variant: that prop only changes what is INSIDE the menu
//    (Mute vs Unmute), so with the menu closed it renders identically.
//  - An auto-open story clicking the real trigger in a mount effect: the popover
//    never appears in the capture. Same outcome as the documented ShareMenu and
//    ReactionsDialog cases — this component's `initial={{opacity:0}}` is
//    hardcoded on the motion.div rather than gated on useReducedMotion(), so the
//    matchMedia shim cannot reach it either.
