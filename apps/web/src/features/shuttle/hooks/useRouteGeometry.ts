import { useQuery } from '@tanstack/react-query'
import { fetchRouteGeometry } from '../lib/routeGeometry'

export function useRouteGeometry(stops: { lat: number; lng: number }[]) {
  const key = stops.map((s) => `${s.lat},${s.lng}`).join('|')
  return useQuery({
    queryKey: ['shuttle', 'route-geometry', key],
    queryFn: () => fetchRouteGeometry(stops),
    enabled: stops.length >= 2,
    staleTime: 30 * 60 * 1000, // road geometry rarely changes
    gcTime: 60 * 60 * 1000,
    retry: 1,
  })
}
