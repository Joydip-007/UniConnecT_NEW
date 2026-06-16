export type ReactionKey = 'like' | 'love' | 'care' | 'haha' | 'wow' | 'sad' | 'angry'
export type MessageReactionKey = 'like' | 'love' | 'care' | 'haha' | 'wow' | 'angry'

export interface ReactionConfig {
  key: ReactionKey
  label: string
  /** Twemoji CDN codepoint (used to build the SVG URL) */
  codepoint: string
  popColor: string
}

export const REACTIONS: ReactionConfig[] = [
  { key: 'like',  label: 'Like',  codepoint: '1f44d', popColor: 'var(--uc-indigo)' },
  { key: 'love',  label: 'Love',  codepoint: '2764',  popColor: '#e0245e' },
  { key: 'care',  label: 'Care',  codepoint: '1f917', popColor: '#f4900c' },
  { key: 'haha',  label: 'Haha',  codepoint: '1f602', popColor: '#f4900c' },
  { key: 'wow',   label: 'Wow',   codepoint: '1f62e', popColor: '#f4900c' },
  { key: 'sad',   label: 'Sad',   codepoint: '1f622', popColor: '#5c8dcf' },
  { key: 'angry', label: 'Angry', codepoint: '1f621', popColor: '#e9710f' },
]

export const MESSAGE_REACTIONS: ReactionConfig[] = REACTIONS.filter(
  (r) => r.key !== 'sad',
) as ReactionConfig[]

export const REACTION_MAP = new Map(REACTIONS.map((r) => [r.key, r]))

export function twemojiUrl(codepoint: string): string {
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${codepoint}.svg`
}

export function totalReactions(counts: Record<string, number>): number {
  return Object.values(counts).reduce((sum, n) => sum + n, 0)
}

export function topReactions(
  counts: Record<string, number>,
  max = 3,
): ReactionConfig[] {
  return REACTIONS.filter((r) => (counts[r.key] ?? 0) > 0)
    .sort((a, b) => (counts[b.key] ?? 0) - (counts[a.key] ?? 0))
    .slice(0, max)
}
