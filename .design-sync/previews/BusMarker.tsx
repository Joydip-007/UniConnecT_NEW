import { MapContainer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { BusMarker } from 'web';

const route = {
  id: 'r1',
  name: 'Route 1 — Uttara',
  color: '#5B5BD6',
  isActive: true,
  stops: [
    { id: 's1', name: 'UIU Campus', orderIndex: 0, lat: 23.815, lng: 90.4239 },
    { id: 's2', name: 'Notun Bazar', orderIndex: 1, lat: 23.79, lng: 90.418 },
  ],
};

function MapShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ height: 260, width: 260, background: 'var(--surface-raised)', borderRadius: 'var(--r-lg)' }}>
      <MapContainer center={[23.8, 90.41]} zoom={14} zoomControl={false} dragging={false} style={{ height: '100%', width: '100%' }}>
        {children}
      </MapContainer>
    </div>
  );
}

export function LiveBus() {
  return (
    <MapShell>
      <BusMarker
        route={route}
        bus={{ routeId: 'r1', lat: 23.8, lng: 90.41, headingDeg: 45, direction: 'outbound', speedKmh: 32, source: 'live', updatedAt: new Date().toISOString() }}
      />
    </MapShell>
  );
}

export function EstimatedBus() {
  return (
    <MapShell>
      <BusMarker
        route={route}
        bus={{ routeId: 'r1', lat: 23.8, lng: 90.41, headingDeg: 180, direction: 'inbound', speedKmh: null, source: 'estimated', updatedAt: null }}
      />
    </MapShell>
  );
}
