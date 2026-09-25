import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders } from 'axios'
import { Users } from 'lucide-react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DetailUnavailable } from './DetailUnavailable'
import { isMissingError } from '@/lib/httpErrors'
import { useShellStore } from '@/stores/shellStore'

function axiosError(status?: number) {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError(
    'failed',
    undefined,
    config,
    undefined,
    status ? { status, statusText: '', data: {}, headers: {}, config } : undefined,
  )
}

beforeEach(() => {
  useShellStore.setState({ bareCount: 0 })
})

describe('isMissingError', () => {
  it('treats 404 and 403 as a real miss and everything else as a failed request', () => {
    expect(isMissingError(axiosError(404))).toBe(true)
    expect(isMissingError(axiosError(403))).toBe(true)
    expect(isMissingError(axiosError(500))).toBe(false)
    expect(isMissingError(axiosError())).toBe(false)
    expect(isMissingError(new Error('x'))).toBe(false)
  })
})

describe('DetailUnavailable', () => {
  it('not-found offers a way back', async () => {
    const onBack = vi.fn()
    render(
      <DetailUnavailable
        kind="not-found"
        icon={Users}
        title="Group not found"
        body="Gone."
        backLabel="Back to groups"
        onBack={onBack}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /Back to groups/ }))
    expect(onBack).toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('failed is an alert with Try again, and drops the rails while mounted', async () => {
    const onRetry = vi.fn()
    const { unmount } = render(
      <DetailUnavailable kind="failed" title="We couldn't load this profile" body="Check." onRetry={onRetry} />,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(useShellStore.getState().bareCount).toBe(1)
    await userEvent.click(screen.getByRole('button', { name: /Try again/ }))
    expect(onRetry).toHaveBeenCalled()
    unmount()
    expect(useShellStore.getState().bareCount).toBe(0)
  })
})
