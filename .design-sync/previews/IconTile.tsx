import { IconTile } from 'web';
import { GraduationCap, Sparkles, BookOpen } from 'lucide-react';

// The orange tile that fronts every learning-path card and quiz row. 42 is the
// shipped size; it is a fixed square on --uc-orange-bg with --uc-orange-l content.

const frame = {
  display: 'flex',
  gap: 12,
  alignItems: 'center',
  padding: 16,
  width: 360,
  background: 'var(--surface-page)',
};

export function ShippedSize() {
  return (
    <div style={frame}>
      <IconTile size={42}>
        <GraduationCap size={20} />
      </IconTile>
      <IconTile size={42}>
        <Sparkles size={20} />
      </IconTile>
      <IconTile size={42}>
        <BookOpen size={20} />
      </IconTile>
    </div>
  );
}

export function SizeScale() {
  return (
    <div style={frame}>
      <IconTile size={28}>
        <BookOpen size={14} />
      </IconTile>
      <IconTile size={34}>
        <BookOpen size={16} />
      </IconTile>
      <IconTile size={42}>
        <BookOpen size={20} />
      </IconTile>
    </div>
  );
}

export function InAPathRow() {
  return (
    <div
      style={{
        padding: 16,
        width: 360,
        background: 'var(--surface-page)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 14,
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
        }}
      >
        <IconTile size={42}>
          <GraduationCap size={20} />
        </IconTile>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
            Intro to data structures
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            6 units · 184 learners enrolled
          </div>
        </div>
      </div>
    </div>
  );
}
