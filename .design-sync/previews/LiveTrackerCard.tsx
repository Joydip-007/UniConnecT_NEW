import { LiveTrackerCard } from 'web';

const route = {
  id: 'r1',
  name: 'Route 1 — Uttara',
  color: '#5B5BD6',
  isActive: true,
  frequency: 'Every 20 min',
  operatingHours: '7:00 AM – 8:00 PM',
  stops: [
    { id: 's1', name: 'UIU Campus', orderIndex: 0, lat: 23.815, lng: 90.4239 },
    { id: 's2', name: 'Notun Bazar', orderIndex: 1, lat: 23.79, lng: 90.418 },
    { id: 's3', name: 'Uttara Sector 7', orderIndex: 2, lat: 23.87, lng: 90.398 },
  ],
};

export function LiveTracking() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 380 }}>
      <LiveTrackerCard
        route={route}
        currentLocation={{
          routeId: 'r1',
          lat: 23.8,
          lng: 90.41,
          speedKmh: 34,
          headingDeg: 90,
          updatedAt: new Date(Date.now() - 15_000).toISOString(),
        }}
        derived={{ progress: 45, nearestStopIdx: 0, nextStopIdx: 1, etaMinutes: 6 }}
        atFinalStop={false}
        source="live"
      />
    </div>
  );
}

export function Estimated() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 380 }}>
      <LiveTrackerCard
        route={route}
        currentLocation={{
          routeId: 'r1',
          lat: 23.8,
          lng: 90.41,
          speedKmh: 0,
          headingDeg: 90,
          updatedAt: new Date().toISOString(),
        }}
        derived={{ progress: 20, nearestStopIdx: 0, nextStopIdx: 1, etaMinutes: 10 }}
        atFinalStop={false}
        source="estimated"
      />
    </div>
  );
}

export function Offline() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 380 }}>
      <LiveTrackerCard route={route} currentLocation={null} derived={{ progress: 0, nearestStopIdx: 0, nextStopIdx: 0, etaMinutes: null }} atFinalStop={false} />
    </div>
  );
}
