import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@uniconnect/shared/types'
import { server } from '@/tests/msw/server'
import { useAuthStore } from '@/stores/authStore'
import { JobCard, type Job } from './JobCard'

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: 'j1',
    title: 'Junior backend engineer',
    company: 'Brain Station 23',
    location: 'Mohakhali, Dhaka',
    type: 'full_time',
    description: 'Build REST services.',
    requirements: ['Node.js', 'Docker'],
    salaryRange: null,
    applicationUrl: null,
    deadline: new Date(Date.now() + 20 * 86_400_000).toISOString(),
    postedBy: { id: 'p1', fullName: 'Nusrat Jahan', profile: { avatarUrl: null, headline: null, department: null } },
    applicationCount: 17,
    myApplication: null,
    isSaved: false,
    viewCount: 0,
    eligibleDepartments: null,
    eligibleBatches: null,
    minCgpa: null,
    ...overrides,
  }
}

function signIn(role: User['role'], profile: Partial<User['profile']> = {}) {
  useAuthStore.setState({
    user: {
      id: 'me',
      role,
      profile: { fullName: 'Tanvir Ahmed', department: 'CSE', batchYear: '2026', cgpa: 3.42, skills: ['Node.js'], ...profile },
    } as unknown as User,
  })
}

function renderCard(j: Job) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <JobCard job={j} queryKey={['jobs', 'list', {}]} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('JobCard', () => {
  beforeEach(() => signIn('student'))

  it('blocks a student outside the allowed departments and says why', () => {
    renderCard(job({ eligibleDepartments: ['EEE'] }))
    expect(screen.getByRole('button', { name: /not eligible/i })).toBeDisabled()
    expect(screen.getByText(/open to eee only/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument()
  })

  it('lets an eligible student apply and names the missing skills', () => {
    renderCard(job({ eligibleDepartments: ['CSE'], minCgpa: 3 }))
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled()
    expect(screen.getByText(/1 of 2 skills match · missing docker/i)).toBeInTheDocument()
  })

  it('does not apply audience rules to non-students', () => {
    signIn('alumni', { department: 'BBA' })
    renderCard(job({ eligibleDepartments: ['CSE'] }))
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled()
    expect(screen.queryByText(/eligible/i)).not.toBeInTheDocument()
  })

  it('shows the application status and withdraws after confirming', async () => {
    let withdrawn = false
    server.use(
      http.post('*/jobs/:id/withdraw', () => {
        withdrawn = true
        return HttpResponse.json({ data: { status: 'withdrawn' } })
      }),
    )
    renderCard(job({ myApplication: { status: 'shortlisted' } }))
    expect(screen.getByText('Shortlisted')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Withdraw' }))
    const dialog = screen.getByRole('alertdialog', { name: /withdraw this application/i })
    expect(dialog).toHaveTextContent(/can't reapply/i)

    await userEvent.click(within(dialog).getByRole('button', { name: 'Withdraw' }))
    await vi.waitFor(() => expect(withdrawn).toBe(true))
  })

  it('renders a withdrawn application as final, with no apply or withdraw', () => {
    renderCard(job({ myApplication: { status: 'withdrawn' } }))
    expect(screen.getByText('Withdrawn')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Withdraw' })).not.toBeInTheDocument()
  })
})
