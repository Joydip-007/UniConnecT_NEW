import { SmallBtn } from 'web';
import { Sparkles, Plus, Trash2 } from 'lucide-react';

// The admin Learning screen's row/toolbar button. Three tones carry the meaning —
// ghost for neutral actions, tint for the AI affordances, solid for the primary —
// and `size` is the only geometry knob: 5px/12px inside cards, 7px/14px on toolbars.

const frame = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap' as const,
  alignItems: 'center',
  padding: 16,
  background: 'var(--surface-page)',
};

export function Tones() {
  return (
    <div style={frame}>
      <SmallBtn tone="ghost">Preview</SmallBtn>
      <SmallBtn tone="tint" icon={<Sparkles size={14} />}>
        Draft with AI
      </SmallBtn>
      <SmallBtn tone="solid" icon={<Plus size={14} />}>
        New learning path
      </SmallBtn>
    </div>
  );
}

export function ToolbarSize() {
  return (
    <div style={frame}>
      <SmallBtn tone="tint" size="bar" icon={<Sparkles size={14} />}>
        Draft with AI
      </SmallBtn>
      <SmallBtn tone="solid" size="bar" icon={<Plus size={14} />}>
        New learning path
      </SmallBtn>
    </div>
  );
}

export function Disabled() {
  return (
    <div style={frame}>
      <SmallBtn tone="ghost" disabled icon={<Trash2 size={14} />}>
        Delete
      </SmallBtn>
      <SmallBtn tone="solid" disabled>
        Publish
      </SmallBtn>
    </div>
  );
}
