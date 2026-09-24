import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, Link, useLocation } from 'react-router-dom'
import { useBackLink } from './useBackLink'

function Detail() {
  const back = useBackLink({ path: '/feed', label: 'Back to feed' })
  return <button onClick={back.goBack}>{back.label}</button>
}

function Where() {
  const { pathname, search } = useLocation()
  return <p data-testid="where">{pathname + search}</p>
}

function renderAt(initial: Parameters<typeof MemoryRouter>[0]['initialEntries']) {
  return render(
    <MemoryRouter initialEntries={initial}>
      <Routes>
        <Route
          path="/explore"
          element={<Link to="/feed/p1" state={{ from: { path: '/explore?see=trending', label: 'Back to explore' } }}>open post</Link>}
        />
        <Route path="/feed/:id" element={<Detail />} />
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </MemoryRouter>,
  )
}

describe('useBackLink', () => {
  it('returns to the exact page that passed an origin', async () => {
    const user = userEvent.setup()
    renderAt(['/explore?see=trending'])
    await user.click(screen.getByText('open post'))
    await user.click(screen.getByRole('button', { name: 'Back to explore' }))
    expect(screen.getByTestId('where')).toHaveTextContent('/explore?see=trending')
  })

  it('falls back to the page default when opened without an origin', async () => {
    const user = userEvent.setup()
    renderAt(['/feed/p1'])
    await user.click(screen.getByRole('button', { name: 'Back to feed' }))
    expect(screen.getByTestId('where')).toHaveTextContent('/feed')
  })
})
