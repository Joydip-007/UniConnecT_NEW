import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GroupTabRail } from './GroupTabRail'

const TABS = [
  { value: 'feed', label: 'Feed' },
  { value: 'members', label: 'Members' },
  { value: 'join-requests', label: 'Join requests', badge: 3 },
]

describe('GroupTabRail', () => {
  it('marks exactly one tab selected', () => {
    render(<GroupTabRail tabs={TABS} active="members" onChange={() => {}} />)
    const selected = screen.getAllByRole('tab').filter((t) => t.getAttribute('aria-selected') === 'true')
    expect(selected).toHaveLength(1)
    expect(selected[0]).toHaveTextContent('Members')
  })

  it('reports the tab value, not its label', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<GroupTabRail tabs={TABS} active="feed" onChange={onChange} />)

    await user.click(screen.getByRole('tab', { name: /Join requests/ }))
    expect(onChange).toHaveBeenCalledWith('join-requests')
  })

  // The badge is the whole reason an admin looks at this row; a zero badge would read
  // as work waiting when there is none.
  it('shows a pending count but hides a zero', () => {
    const { unmount } = render(<GroupTabRail tabs={TABS} active="feed" onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: /Join requests/ })).toHaveTextContent('3')
    unmount()

    render(
      <GroupTabRail
        tabs={[{ value: 'join-requests', label: 'Join requests', badge: 0 }]}
        active="feed"
        onChange={() => {}}
      />,
    )
    expect(screen.getByRole('tab', { name: /Join requests/ })).toHaveTextContent(/^Join requests$/)
  })
})
