import { Chip } from 'web';

// Filter chip from the admin Learning screen. Controlled: `active` drives the indigo
// tint, everything else sits on the raised surface. 12px/500, pill radius.

const frame = {
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap' as const,
  alignItems: 'center',
  padding: 16,
  width: 360,
  background: 'var(--surface-page)',
};

export function OnAndOff() {
  return (
    <div style={frame}>
      <Chip label="All paths" active onClick={() => {}} />
      <Chip label="Published" active={false} onClick={() => {}} />
    </div>
  );
}

export function DifficultyFilter() {
  return (
    <div style={frame}>
      <Chip label="Beginner" active={false} onClick={() => {}} />
      <Chip label="Intermediate" active onClick={() => {}} />
      <Chip label="Advanced" active={false} onClick={() => {}} />
    </div>
  );
}

export function LongLabel() {
  return (
    <div style={frame}>
      <Chip label="Needs review" active onClick={() => {}} />
      <Chip label="Scheduled for next term" active={false} onClick={() => {}} />
    </div>
  );
}
