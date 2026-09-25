import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useDriverBroadcastStore } from '@/stores/driverBroadcastStore'
import { useShuttleLiveState } from '@/features/shuttle'
import { useShiftMutations, useShuttleDuty } from '@/features/shuttle/hooks/useShuttleDuty'
import { routeNumberLabel } from '@/features/shuttle/lib/schedule'
import { DriveTab } from '@/features/shuttle/components/driver/DriveTab'
import { DutyTab } from '@/features/shuttle/components/driver/DutyTab'
import { LiveTab } from '@/features/shuttle/components/driver/LiveTab'
import { DriverLiveDialog } from '@/features/shuttle/components/driver/DriverLiveDialog'
import { DriverNewsTab } from '@/features/shuttle/components/driver/DriverNewsTab'
import { DriverMessagesTab } from '@/features/shuttle/components/driver/DriverMessagesTab'

const TABS = ['drive', 'duty', 'live', 'news', 'messages'] as const
type Tab = (typeof TABS)[number]

/**
 * Driver mode (Shuttle Tracker.dc.html). One screen, five tabs — the driver's rail rows
 * and mobile bar both point at `?tab=`, and Drive (the default) stays out of the URL.
 * The GPS watch itself lives in `DriverBroadcastHost`, so a tab switch never stops it.
 */
export default function ShuttleDrivePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const raw = searchParams.get('tab')
  const tab: Tab = TABS.includes(raw as Tab) ? (raw as Tab) : 'drive'

  const user = useAuthStore((s) => s.user)
  const { routeId, active, status, lastFix, setRoute, start, stop } = useDriverBroadcastStore()
  const { routes, busStates, now } = useShuttleLiveState()
  const { data: duty } = useShuttleDuty()
  const shifts = useShiftMutations()
  // undefined = closed; null = open on the default route.
  const [liveRouteId, setLiveRouteId] = useState<string | null | undefined>(undefined)

  // A shift still open server-side (a reload mid-trip) resumes broadcasting on its route.
  useEffect(() => {
    if (duty?.activeShift && !active) start(duty.activeShift.routeId)
    else if (!routeId && duty?.assignedRouteId) setRoute(duty.assignedRouteId)
    // Only when the server's answer changes — not on every local toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duty?.activeShift?.id, duty?.assignedRouteId])

  function goTab(next: Tab) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (next === 'drive') params.delete('tab')
        else params.set('tab', next)
        return params
      },
      { replace: false },
    )
  }

  function handleStart() {
    if (!routeId) return
    shifts.start.mutate(routeId, { onSuccess: () => start(routeId) })
  }

  function handleStop() {
    stop()
    shifts.stop.mutate()
  }

  const myRouteId = active ? routeId : (duty?.assignedRouteId ?? routeId)
  const openRouteId = liveRouteId === null ? (myRouteId ?? routes[0]?.id ?? null) : (liveRouteId ?? null)
  const openRoute = liveRouteId === undefined ? null : (routes.find((r) => r.id === openRouteId) ?? null)
  const name = user?.profile.fullName ?? user?.email ?? ''

  return (
    <div className="driver-page">
      {tab === 'drive' && (
        <DriveTab
          name={name}
          routes={routes}
          selectedRouteId={routeId}
          onSelectRoute={setRoute}
          active={active}
          status={status}
          lastFix={lastFix}
          shift={duty?.activeShift ?? null}
          starting={shifts.start.isPending}
          onStart={handleStart}
          onStop={handleStop}
          onRiders={(delta) => shifts.riders.mutate(delta)}
          ridersPending={shifts.riders.isPending}
          onOpenLive={() => {
            goTab('live')
            setLiveRouteId(routeId)
          }}
        />
      )}
      {tab === 'duty' && <DutyTab duty={duty} routes={routes} now={now} active={active} onGoDrive={() => goTab('drive')} />}
      {tab === 'live' && (
        <LiveTab routes={routes} busStates={busStates} myRouteId={myRouteId} broadcasting={active} onOpen={setLiveRouteId} />
      )}
      {tab === 'news' && <DriverNewsTab />}
      {tab === 'messages' && <DriverMessagesTab />}

      <DriverLiveDialog
        route={openRoute}
        routes={routes}
        busStates={busStates}
        mine={openRoute !== null && openRoute.id === myRouteId}
        broadcasting={active}
        onClose={() => setLiveRouteId(undefined)}
      />

      {/* Phones only: the broadcast stays one tap away from every other tab. */}
      {active && tab !== 'drive' && routeId && (
        <button type="button" onClick={() => goTab('drive')} className="driver-live-strip">
          <span className="driver-live-strip-dot" />
          <span style={{ flex: 1, textAlign: 'left', fontSize: 13, fontWeight: 500 }}>
            Broadcasting live · {routeNumberLabel(routes, routeId)}
          </span>
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  )
}
