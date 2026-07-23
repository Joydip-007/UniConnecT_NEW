import { ShuttleMap } from 'web';

const routes = [
  {
    id: 'r1',
    name: 'Route 1 — Uttara',
    color: '#5B5BD6',
    isActive: true,
    stops: [
      { id: 's1', name: 'UIU Campus', orderIndex: 0, lat: 23.815, lng: 90.4239 },
      { id: 's2', name: 'Notun Bazar', orderIndex: 1, lat: 23.79, lng: 90.418 },
      { id: 's3', name: 'Uttara Sector 7', orderIndex: 2, lat: 23.87, lng: 90.398 },
    ],
  },
];

const busStates = {
  r1: { routeId: 'r1', lat: 23.8, lng: 90.41, headingDeg: 90, direction: 'outbound' as const, speedKmh: 30, source: 'live' as const, updatedAt: new Date().toISOString() },
};

export function Default() {
  return (
    <div style={{ height: 420, width: 480 }}>
      <ShuttleMap
        routes={routes}
        busStates={busStates}
        selectedRouteId="r1"
        focusMode
        liveOnly={false}
        userLocation={{ lat: 23.81, lng: 90.415 }}
        onSelectRoute={() => {}}
      />
    </div>
  );
}
