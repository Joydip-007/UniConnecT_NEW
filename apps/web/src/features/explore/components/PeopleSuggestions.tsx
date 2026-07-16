import type { UserSuggestion } from '../types'
import { PersonSuggestionCard } from './PersonSuggestionCard'

interface Props {
  people: UserSuggestion[]
}

export function PeopleSuggestions({ people }: Props) {
  if (people.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>No suggestions right now.</p>
    )
  }
  return (
    <>
      {people.map((person, i) => (
        <PersonSuggestionCard key={person.id} person={person} isLast={i === people.length - 1} />
      ))}
    </>
  )
}
