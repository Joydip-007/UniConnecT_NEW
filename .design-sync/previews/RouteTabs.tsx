import { useState } from 'react';
import { RouteTabs } from 'web';

const routes = [
  { id: 'r1', name: 'Route 1 — Uttara', color: '#5B5BD6', stops: [], isActive: true },
  { id: 'r2', name: 'Route 2 — Mirpur', color: '#E8814A', stops: [], isActive: true },
  { id: 'r3', name: 'Route 3 — Badda', color: '#3DBE8B', stops: [], isActive: true },
];

export function Default() {
  const [selected, setSelected] = useState('r1');
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 640 }}>
      <RouteTabs routes={routes} selectedRouteId={selected} onSelect={setSelected} />
    </div>
  );
}

export function SecondRouteSelected() {
  const [selected, setSelected] = useState('r2');
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 640 }}>
      <RouteTabs routes={routes} selectedRouteId={selected} onSelect={setSelected} />
    </div>
  );
}
