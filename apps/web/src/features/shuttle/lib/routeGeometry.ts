const ORS_URL = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson'

export async function fetchRouteGeometry(
  stops: { lat: number; lng: number }[],
): Promise<[number, number][] | null> {
  if (stops.length < 2) return null

  const apiKey = import.meta.env.VITE_ORS_API_KEY as string | undefined
  if (!apiKey) return null

  // ORS expects [longitude, latitude] pairs (GeoJSON order)
  const coordinates = stops.map((s) => [s.lng, s.lat])

  const res = await fetch(ORS_URL, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ coordinates }),
  })

  if (!res.ok) return null

  const data = (await res.json()) as {
    features?: { geometry?: { coordinates?: [number, number][] } }[]
  }
  const raw = data?.features?.[0]?.geometry?.coordinates
  if (!Array.isArray(raw) || raw.length === 0) return null

  // Convert ORS [lng, lat] → Leaflet [lat, lng]
  return raw.map(([lng, lat]) => [lat, lng])
}
