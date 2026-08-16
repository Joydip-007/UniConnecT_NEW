import { DiscoverySection } from 'web';

// A layout wrapper, so it only means anything with real children in it. Both
// layouts are covered: the horizontal snap carousel (default) and the dense
// vertical list.

function Card({ title, meta }: { title: string; meta: string }) {
  return (
    <div
      style={{
        width: 150,
        flexShrink: 0,
        scrollSnapAlign: 'start',
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 12,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.35 }}>
        {title}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{meta}</div>
    </div>
  );
}

function Row({ title, meta }: { title: string; meta: string }) {
  return (
    <div style={{ padding: '10px 0', borderBottom: '0.5px solid var(--border-default)' }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>{meta}</div>
    </div>
  );
}

export function ScrollCarousel() {
  return (
    <div style={{ padding: 16, background: 'var(--surface-page)', width: 440 }}>
      <DiscoverySection label="Groups to join" seeAllTo="/groups">
        <Card title="CSE Thesis 2026" meta="128 members" />
        <Card title="UIU Photography Club" meta="341 members" />
        <Card title="Competitive Programming" meta="76 members" />
      </DiscoverySection>
    </div>
  );
}

export function DenseList() {
  return (
    <div style={{ padding: 16, background: 'var(--surface-page)', width: 440 }}>
      <DiscoverySection label="Trending posts" layout="list" seeAllTo="/explore" seeAllLabel="Explore">
        <Row title="Anyone else got the Pathao interview call?" meta="42 reactions · 18 comments" />
        <Row title="Thesis defence slots are out" meta="27 reactions · 9 comments" />
      </DiscoverySection>
    </div>
  );
}

export function NoSeeAll() {
  return (
    <div style={{ padding: 16, background: 'var(--surface-page)', width: 440 }}>
      <DiscoverySection label="Recently active">
        <Card title="Alumni networking night" meta="Sep 4 · UIU Auditorium" />
        <Card title="Career fair 2026" meta="Sep 18 · Campus grounds" />
      </DiscoverySection>
    </div>
  );
}
