import { useCallback, useEffect, useState } from 'react'
import { disablePush, enablePush, getExistingSubscription, isPushSupported, pushPermission } from '@/lib/push'

interface PushState {
  supported: boolean
  permission: NotificationPermission | 'unsupported'
  enabled: boolean
  loading: boolean
}

export function usePushSettings() {
  const [state, setState] = useState<PushState>({
    supported: isPushSupported(),
    permission: pushPermission(),
    enabled: false,
    loading: true,
  })

  const refresh = useCallback(async () => {
    if (!isPushSupported()) {
      setState({ supported: false, permission: 'unsupported', enabled: false, loading: false })
      return
    }
    const subscription = await getExistingSubscription()
    setState({
      supported: true,
      permission: pushPermission(),
      enabled: Boolean(subscription),
      loading: false,
    })
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const enable = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }))
    const ok = await enablePush()
    await refresh()
    return ok
  }, [refresh])

  const disable = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }))
    await disablePush()
    await refresh()
  }, [refresh])

  return { ...state, enable, disable }
}
