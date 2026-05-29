export interface Participant {
  id: string
  fullName: string
  role: 'student' | 'alumni' | 'faculty' | 'admin'
  profile: {
    avatarUrl: string | null
    headline: string | null
  }
}

export interface LastMessage {
  body: string
  sentAt: string
  senderId: string
}

export interface Conversation {
  id: string
  type: 'direct' | 'group' | 'mentorship'
  name: string | null
  otherParticipant: Participant | null
  lastMessage: LastMessage | null
  unreadCount: number
}
