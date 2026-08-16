import { Section } from 'web';

// The borderless counterpart to Widget: a flat block in the right rail, optionally
// separated from the block above it by a 0.5px --border-default rule.

function Row({ title, meta }: { title: string; meta: string }) {
  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>{meta}</div>
    </div>
  );
}

export function Default() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 320 }}>
      <Section>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 12 }}>
          People you may know
        </div>
        <Row title="Nabila Rahman" meta="Product designer · CSE" />
        <Row title="Tanvir Ahmed" meta="Computer Science & Engineering" />
      </Section>
    </div>
  );
}

export function WithTopDivider() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 320 }}>
      <Section>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 12 }}>
          People you may know
        </div>
        <Row title="Nabila Rahman" meta="Product designer · CSE" />
      </Section>
      <Section withTopDivider>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 12 }}>
          Upcoming events
        </div>
        <Row title="Alumni networking night" meta="UIU Auditorium · 6:30 PM" />
      </Section>
    </div>
  );
}
