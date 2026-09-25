import { format, parseISO } from 'date-fns'
import type { NewsAuthor, NewsItem } from './types'

const EXCERPT_LENGTH = 160
const WORDS_PER_MINUTE = 200

/** The list line: the author's summary when there is one, else the body's opening. */
export function newsExcerpt(item: Pick<NewsItem, 'summary' | 'body'>): string {
  if (item.summary?.trim()) return item.summary.trim()
  const body = item.body.trim()
  return body.length > EXCERPT_LENGTH ? `${body.slice(0, EXCERPT_LENGTH).trimEnd()}…` : body
}

export function readMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE))
}

export function newsDate(item: Pick<NewsItem, 'publishedAt' | 'createdAt'>): string {
  return format(parseISO(item.publishedAt ?? item.createdAt), 'MMM d, yyyy')
}

/**
 * Who an article speaks for — mirrors `SOURCE_LABEL_SQL` in the API's news service, so
 * the byline and the rail's "Official sources" name the same office.
 */
export function newsSource(author: NewsAuthor, isImported: boolean): string {
  if (isImported) return 'University website'
  if (author.role === 'admin') return 'University administration'
  return author.department?.trim() || author.fullName || 'UniConnecT'
}

export function authorInitials(name: string | null): string {
  const parts = (name ?? 'U').trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Tags are typed as a comma list in the draft form and stored lowercased. */
export function parseTags(value: string): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((tag) => tag.trim().replace(/^#/, '').toLowerCase())
        .filter(Boolean),
    ),
  ].slice(0, 8)
}
