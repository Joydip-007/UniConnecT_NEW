import { StopList } from 'web';

const route = {
  id: 'r1',
  name: 'Route 1 — Uttara',
  color: '#5B5BD6',
  isActive: true,
  stops: [
    { id: 's1', name: 'UIU Campus', orderIndex: 0, lat: 23.815, lng: 90.4239 },
    { id: 's2', name: 'Notun Bazar', orderIndex: 1, lat: 23.79, lng: 90.418 },
    { id: 's3', name: 'Badda Link Road', orderIndex: 2, lat: 23.78, lng: 90.42 },
    { id: 's4', name: 'Kuril Bishwaroad', orderIndex: 3, lat: 23.822, lng: 90.424 },
    { id: 's5', name: 'Uttara Sector 7', orderIndex: 4, lat: 23.87, lng: 90.398 },
  ],
};

export function EnRoute() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 380 }}>
      <StopList
        route={route}
        hasLocation
        derived={{ progress: 45, nearestStopIdx: 1, nextStopIdx: 2, etaMinutes: 6 }}
        atFinalStop={false}
      />
    </div>
  );
}

export function ArrivedAtFinalStop() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 380 }}>
      <StopList
        route={route}
        hasLocation
        derived={{ progress: 100, nearestStopIdx: 4, nextStopIdx: 4, etaMinutes: 0 }}
        atFinalStop
      />
    </div>
  );
}

export function NoLocation() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 380 }}>
      <StopList
        route={route}
        hasLocation={false}
        derived={{ progress: 0, nearestStopIdx: 0, nextStopIdx: 0, etaMinutes: null }}
        atFinalStop={false}
      />
    </div>
  );
}
