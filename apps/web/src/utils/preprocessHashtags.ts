/**
 * Converts inline hashtags in markdown content to clickable markdown links.
 * e.g. "#csefest" → "[#csefest](/explore/tag/csefest)"
 *
 * Rules:
 * - Only matches `#word` not already inside a markdown link (`[#...`)
 * - Tag name in the URL is lowercased for consistent routing
 * - Display text preserves original casing
 */
export function preprocessHashtags(content: string): string {
  return content.replace(/(?<!\[)#([\w]+)/g, (_match, tag: string) =>
    `[#${tag}](/explore/tag/${tag.toLowerCase()})`,
  )
}
