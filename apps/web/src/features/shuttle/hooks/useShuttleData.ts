import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { socket } from '@/lib/socket'
import type { LiveLocation, ShuttleRoute } from '../types'

export function useShuttleData(selectedRouteId: string | null) {
  const [liveLocations, setLiveLocations] = useState<Record<string, LiveLocation>>({})

  const { data: routesData, isLoading: routesLoading } = useQuery<ShuttleRoute[]>({
    queryKey: ['shuttle', 'routes'],
    queryFn: () =>
      api.get<{ data: ShuttleRoute[] }>('/shuttle/routes').then((r) => r.data.data),
  })

  const { data: locationsData } = useQuery<LiveLocation[]>({
    queryKey: ['shuttle', 'locations'],
    queryFn: () =>
      api.get<{ data: LiveLocation[] }>('/shuttle/locations').then((r) => r.data.data),
    refetchInterval: 30_000,
  })

  const routes = useMemo(() => routesData ?? [], [routesData])

  // Seed live locations from REST — newer updatedAt wins
  useEffect(() => {
    if (!locationsData) return
    setLiveLocations((prev) => {
      const next = { ...prev }
      for (const loc of locationsData) {
        const existing = prev[loc.routeId]
        if (!existing || loc.updatedAt > existing.updatedAt) {
          next[loc.routeId] = loc
        }
      }
      return next
    })
  }, [locationsData])

  // Socket: watch selected route; unwatch on cleanup / route change
  useEffect(() => {
    if (!selectedRouteId) return

    socket.emit('shuttle:watch', { routeId: selectedRouteId })

    function onLocation(payload: LiveLocation) {
      if (payload.routeId !== selectedRouteId) return
      setLiveLocations((prev) => ({ ...prev, [payload.routeId]: payload }))
    }

    socket.on('shuttle:location', onLocation)

    return () => {
      socket.emit('shuttle:unwatch', { routeId: selectedRouteId })
      socket.off('shuttle:location', onLocation)
    }
  }, [selectedRouteId])

  const currentLocation = selectedRouteId ? (liveLocations[selectedRouteId] ?? null) : null

  return { routes, routesLoading, currentLocation }
}
