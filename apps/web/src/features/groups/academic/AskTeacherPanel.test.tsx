import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import { AskTeacherPanel } from './AskTeacherPanel'

// The chat card composes the real messages feature; stub it so this test stays
// about the panel (teacher card, slots, booking), not message pagination.
vi.mock('@/features/messages', () => ({
  ChatView: ({ convId }: { convId: string }) => <div data-testid="chat-view">chat:{convId}</div>,
  MessageInput: () => <input placeholder="Write a message" />,
  useConversationSocket: () => ({ typingUserIds: [] }),
}))

const slots = [
  {
    id: 's1',
    weekday: 2,
    startTime: '14:00',
    endTime: '15:00',
    location: 'Room 402',
    walkIn: true,
    nextOccurrence: '2026-09-29',
    myBooking: null,
    bookings: [
      { id: 'b1', slotId: 's1', bookedFor: '2026-09-29', topic: 'Lab 3 marks', status: 'requested', student: { id: 'u9', fullName: 'Nusrat Jahan' } },
    ],
  },
]

function renderPanel(isAdmin: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <AskTeacherPanel groupId="g1" isAdmin={isAdmin} />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('AskTeacherPanel', () => {
  it('student: shows teacher card, chat for the DM, slots and books one', async () => {
    const user = userEvent.setup()
    let booked: Record<string, unknown> | null = null
    server.use(
      http.post('*/groups/g1/ask-teacher', () =>
        HttpResponse.json({
          data: { conversationId: 'c-42', teacher: { id: 't1', fullName: 'Dr. Rahman', avatarUrl: null, department: 'CSE' } },
        }),
      ),
      http.get('*/groups/g1/consultation-slots', () => HttpResponse.json({ data: { items: slots } })),
      http.post('*/groups/g1/consultation-slots/s1/book', async ({ request }) => {
        booked = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ data: { id: 'b2', slotId: 's1', status: 'requested' } }, { status: 201 })
      }),
    )
    renderPanel(false)

    expect(await screen.findByText('Dr. Rahman')).toBeInTheDocument()
    expect(screen.getByText('Course teacher')).toBeInTheDocument()
    expect(screen.getByTestId('chat-view')).toHaveTextContent('chat:c-42')
    expect(screen.getByText('Direct chat, only you and the teacher')).toBeInTheDocument()

    expect(await screen.findByText('Tuesday, 14:00 – 15:00')).toBeInTheDocument()
    expect(screen.getByText('Room 402, walk in')).toBeInTheDocument()
    // admin roster never leaks into the student view
    expect(screen.queryByText('Nusrat Jahan')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Book a slot' }))
    expect(screen.getByText('What do you want to discuss?')).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText(/One or two lines/), 'Lab 3 marks')
    await user.click(screen.getByRole('button', { name: 'Request slot' }))

    await waitFor(() => expect(booked).toEqual({ topic: 'Lab 3 marks' }))
    expect(await screen.findByText(/Request sent/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
  })

  it('admin: shows the waiting queue and confirms a booking', async () => {
    const user = userEvent.setup()
    let reviewed: Record<string, unknown> | null = null
    server.use(
      http.get('*/groups/g1/ask-teacher/queue', () =>
        HttpResponse.json({
          data: {
            items: [
              { conversationId: 'c-1', student: { id: 'u1', fullName: 'Arif Hossain', avatarUrl: null }, lastMessage: 'Can I resubmit?', lastAt: new Date().toISOString(), unread: 2 },
            ],
          },
        }),
      ),
      http.get('*/groups/g1/consultation-slots', () => HttpResponse.json({ data: { items: slots } })),
      http.patch('*/groups/g1/consultation-slots/s1/bookings/b1', async ({ request }) => {
        reviewed = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ data: { id: 'b1', status: 'confirmed' } })
      }),
    )
    renderPanel(true)

    expect(await screen.findByText('Student questions')).toBeInTheDocument()
    expect(await screen.findByText('1 waiting')).toBeInTheDocument()
    expect(screen.getByText('Arif Hossain')).toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: 'View bookings' }))
    expect(screen.getByText('Bookings for this slot')).toBeInTheDocument()
    expect(screen.getByText('Nusrat Jahan')).toBeInTheDocument()
    expect(screen.getByText('Requested')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(reviewed).toEqual({ status: 'confirmed' }))
  })
})
