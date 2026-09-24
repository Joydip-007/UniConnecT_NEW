import { MessagesWorkspace } from '@/features/messages'

/** `/messages/:id` — the same workspace with a thread open (its own screen on mobile). */
export default function ConversationPage() {
  return <MessagesWorkspace />
}
