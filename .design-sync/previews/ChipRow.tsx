import { Chip, ChipRow } from 'web';

// The 6px flex-wrap row that holds the Learning screen's filter chips.

const frame = { padding: 16, width: 360, background: 'var(--surface-page)' };

export function StatusFilters() {
  return (
    <div style={frame}>
      <ChipRow>
        <Chip label="All" active onClick={() => {}} />
        <Chip label="Published" active={false} onClick={() => {}} />
        <Chip label="Draft" active={false} onClick={() => {}} />
        <Chip label="Needs review" active={false} onClick={() => {}} />
      </ChipRow>
    </div>
  );
}

export function WrapsToTwoLines() {
  return (
    <div style={frame}>
      <ChipRow>
        <Chip label="CSE 3421" active={false} onClick={() => {}} />
        <Chip label="Data structures" active onClick={() => {}} />
        <Chip label="Operating systems" active={false} onClick={() => {}} />
        <Chip label="Machine learning" active={false} onClick={() => {}} />
        <Chip label="Career skills" active={false} onClick={() => {}} />
      </ChipRow>
    </div>
  );
}
