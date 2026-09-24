import type { UserSuggestion } from './types'

interface Viewer {
  department: string | null
  batchYear: string | null
}

/**
 * The "why am I seeing this person" line: mutual connections first, then the
 * strongest shared attribute. Returns null when there is nothing honest to say.
 */
export function suggestionReason(person: UserSuggestion, viewer: Viewer | null | undefined): string | null {
  const parts: string[] = []
  if (person.mutualCount > 0) parts.push(`${person.mutualCount} mutual`)

  const sameDept = !!viewer?.department && person.department === viewer.department
  const sameBatch = !!viewer?.batchYear && person.batchYear === viewer.batchYear
  if (sameDept && sameBatch) parts.push('same batch')
  else if (sameDept) parts.push('same department')
  else if (sameBatch) parts.push(`class of ${person.batchYear}`)

  return parts.length > 0 ? parts.join(' · ') : null
}
