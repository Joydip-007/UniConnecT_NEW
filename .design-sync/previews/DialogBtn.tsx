import { DialogBtn } from 'web';
import { Sparkles, Check } from 'lucide-react';

// Dialog footer button — 13px / 8px 16px, one step up from SmallBtn. Same three
// tones: ghost cancels, tint runs the AI action, solid commits.

const frame = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap' as const,
  alignItems: 'center',
  justifyContent: 'flex-end',
  padding: 16,
  width: 360,
  background: 'var(--surface-page)',
};

export function Tones() {
  return (
    <div style={frame}>
      <DialogBtn tone="ghost">Cancel</DialogBtn>
      <DialogBtn tone="tint" icon={<Sparkles size={14} />}>
        Regenerate
      </DialogBtn>
      <DialogBtn tone="solid" icon={<Check size={14} />}>
        Publish quiz
      </DialogBtn>
    </div>
  );
}

export function DialogFooter() {
  return (
    <div style={{ padding: 16, width: 360, background: 'var(--surface-page)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
          padding: '14px 20px',
          background: 'var(--surface-card)',
          borderTop: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
        }}
      >
        <DialogBtn tone="ghost">Cancel</DialogBtn>
        <DialogBtn tone="solid">Save path</DialogBtn>
      </div>
    </div>
  );
}

export function Generating() {
  return (
    <div style={frame}>
      <DialogBtn tone="ghost" disabled>
        Cancel
      </DialogBtn>
      <DialogBtn tone="solid" disabled icon={<Sparkles size={14} />}>
        Generating…
      </DialogBtn>
    </div>
  );
}
