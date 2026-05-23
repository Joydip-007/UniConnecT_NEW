import type { UserSuggestion } from '../types'
import { PersonSuggestionCard } from './PersonSuggestionCard'

interface Props {
  alumni: UserSuggestion[]
}

export function FeaturedAlumni({ alumni }: Props) {
  if (alumni.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>No featured alumni yet.</p>
    )
  }
  return (
    <>
      {alumni.map((person) => (
        <PersonSuggestionCard key={person.id} person={person} />
      ))}
    </>
  )
}
