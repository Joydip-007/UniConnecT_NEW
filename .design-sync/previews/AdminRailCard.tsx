import { AdminRailCard } from 'web';

// The admin rail's panel chrome — both admin widgets are cards, unlike the
// member rail. `order` lets the queue/stats pair swap without re-listing.

const row = { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', padding: '6px 0' };

export function Panel() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 320 }}>
      <AdminRailCard order={0} label="Needs attention">
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>Needs attention</div>
        <div style={row}><span>Escalated reports</span><span>3</span></div>
        <div style={row}><span>Imported drafts</span><span>12</span></div>
        <div style={row}><span>Deletion requests</span><span>1</span></div>
      </AdminRailCard>
    </div>
  );
}

export function OrderedPair() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <AdminRailCard order={1} label="Needs attention">
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Needs attention (order 1)</div>
      </AdminRailCard>
      <AdminRailCard order={0} label="Campus insights">
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Campus insights (order 0 — renders first)</div>
      </AdminRailCard>
    </div>
  );
}
