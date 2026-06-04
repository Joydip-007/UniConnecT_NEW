import type { ContentSyncConfig, ContentSyncSource } from '@uniconnect/shared'
import { isSkyvernConfigured, pollRun, triggerWorkflow } from './skyvern.service'
import { logger } from '../utils/logger'

/**
 * Resolves raw scraped items per source, preferring a tenant's WordPress REST API
 * (free, structured, reliable) and falling back to the Skyvern browser workflow for
 * non-WordPress sites. Returned objects are camelCase and shaped to `skyvernItemSchema`;
 * the worker validates them before touching the DB.
 */

const PER_PAGE = 5
const MAX_BODY_CHARS = 20000
const DOC_EXT = /\.(pdf|docx?|xlsx?|pptx?|zip|csv|txt)(\?|#|$)/i

type RawItem = Record<string, unknown>
type Grouped = Record<ContentSyncSource, RawItem[]>

interface SourceSpec {
  source: ContentSyncSource
  url: string | null
}

export async function fetchContentItems(
  config: ContentSyncConfig,
  knownSourceUrls: string[],
): Promise<Grouped> {
  const specs: SourceSpec[] = [
    { source: 'news', url: config.newsUrl },
    { source: 'notice', url: config.noticeUrl },
    { source: 'event', url: config.eventUrl },
  ]

  const grouped: Grouped = { news: [], notice: [], event: [] }
  const skyvernSources: SourceSpec[] = []

  for (const spec of specs) {
    if (!spec.url) continue
    const items = await tryWordPress(spec)
    if (items) {
      grouped[spec.source] = items
      logger.info('Content source: WordPress REST', { source: spec.source, count: items.length })
    } else {
      skyvernSources.push(spec)
    }
  }

  if (skyvernSources.length > 0) {
    if (!isSkyvernConfigured()) {
      logger.warn('Non-WordPress sources present but Skyvern is not configured — skipping them', {
        sources: skyvernSources.map((s) => s.source),
      })
    } else {
      // The Skyvern workflow is single-source (one listing URL per run), so call it once per
      // non-WordPress source. This keeps the workflow site-agnostic and sidesteps the
      // empty-source navigation problem a multi-URL workflow would hit for tenants that only
      // configure some of the three pages. Runs are sequential — fallback sources are rare.
      for (const spec of skyvernSources) {
        if (!spec.url) continue
        logger.info('Content source: Skyvern fallback', { source: spec.source })
        const raw = await pollRun(await triggerWorkflow({ listUrl: spec.url, knownSourceUrls }))
        grouped[spec.source] = extractDetailItems(raw)
      }
    }
  }

  return grouped
}

// ---------------------------------------------------------------------------
// WordPress REST adapter
// ---------------------------------------------------------------------------

/**
 * Attempts to fetch a source via the WordPress REST API. Returns null (so the caller
 * falls back to Skyvern) if the site is not WordPress or the post type is unavailable.
 */
async function tryWordPress(spec: SourceSpec): Promise<RawItem[] | null> {
  if (!spec.url) return null
  let parsed: URL
  try {
    parsed = new URL(spec.url)
  } catch {
    return null
  }

  const postType = parsed.pathname.split('/').filter(Boolean).pop()
  if (!postType) return null

  const endpoint =
    `${parsed.origin}/wp-json/wp/v2/${encodeURIComponent(postType)}` +
    `?per_page=${PER_PAGE}&_embed=1&orderby=date&order=desc`

  try {
    // A real browser UA + JSON Accept maximizes the chance non-Cloudflare WAFs serve the
    // REST API (the free path). Sites behind a JS challenge (e.g. BRACU/Cloudflare) still
    // 403 here and correctly fall through to the Skyvern browser path.
    const res = await fetch(endpoint, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        accept: 'application/json',
      },
    })
    if (!res.ok) return null
    const data: unknown = await res.json()
    if (!Array.isArray(data)) return null
    return data.map((item) => mapWordPressItem(spec.source, item as RawItem)).filter((x): x is RawItem => x !== null)
  } catch (error) {
    logger.warn('WordPress REST probe failed; will fall back', {
      source: spec.source,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

function mapWordPressItem(source: ContentSyncSource, item: RawItem): RawItem | null {
  const link = asString(item.link)
  if (!link) return null

  const html = asString(get(item, ['content', 'rendered']))
  const body = htmlToText(html)
  if (!body) return null

  const base: RawItem = {
    sourceUrl: link,
    title: decodeEntities(asString(get(item, ['title', 'rendered']))) || '(untitled)',
    body,
    publishedDate: asString(item.date) || undefined,
    coverUrl: asString(get(item, ['_embedded', 'wp:featuredmedia', 0, 'source_url'])) || undefined,
    attachments: extractAttachments(html),
  }

  if (source === 'event') {
    const acf = (item.acf ?? {}) as RawItem
    base.startsAt = wpDateToIso(asString(acf.event_date_start)) ?? asString(item.date) ?? undefined
    base.endsAt = wpDateToIso(asString(acf.event_date_end)) ?? undefined
    base.location = decodeEntities(asString(acf.event_venue)) || undefined
    base.subCategory = 'general'
  }

  return base
}

function extractAttachments(html: string): Array<{ url: string; fileName?: string }> {
  const urls = new Set<string>()
  const re = /(?:href|src)="([^"]+)"/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    const url = match[1]
    if (DOC_EXT.test(url) && /^https?:\/\//i.test(url)) urls.add(url)
  }
  return [...urls].map((url) => ({ url, fileName: fileNameFromUrl(url) }))
}

function fileNameFromUrl(url: string): string | undefined {
  try {
    const last = new URL(url).pathname.split('/').filter(Boolean).pop()
    return last ? decodeURIComponent(last) : undefined
  } catch {
    return undefined
  }
}

/** WordPress ACF dates look like "2026-05-20 00:00:00"; normalize to ISO-ish "2026-05-20T00:00:00". */
function wpDateToIso(value: string): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.includes(' ') ? trimmed.replace(' ', 'T') : trimmed
}

// ---------------------------------------------------------------------------
// HTML → text
// ---------------------------------------------------------------------------

function htmlToText(html: string): string {
  if (!html) return ''
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')

  text = decodeEntities(text)
  text = text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()

  return text.length > MAX_BODY_CHARS ? `${text.slice(0, MAX_BODY_CHARS).trimEnd()}…` : text
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
}

function decodeEntities(text: string): string {
  if (!text) return ''
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => safeCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (whole, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? whole)
}

function safeCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return ''
  try {
    return String.fromCodePoint(code)
  } catch {
    return ''
  }
}

// ---------------------------------------------------------------------------
// Skyvern output parsing (fallback path)
// ---------------------------------------------------------------------------

/**
 * Normalizes one single-source Skyvern run's output into raw detail items.
 * The `details` for_loop's output is exposed under `details_output` as an array of
 * iterations; each iteration is an array of nested-block outputs, and the extraction
 * block's data lives at `output_value.extracted_information`.
 */
function extractDetailItems(raw: unknown): RawItem[] {
  const parsed = typeof raw === 'string' ? safeJson(raw) : raw
  if (!parsed || typeof parsed !== 'object') return []
  return extractLoopItems((parsed as Record<string, unknown>).details_output)
}

function extractLoopItems(loopOutput: unknown): RawItem[] {
  const items: RawItem[] = []
  for (const iteration of asArray(loopOutput)) {
    for (const block of asArray(iteration)) {
      const extracted = (block as { output_value?: { extracted_information?: unknown } })?.output_value
        ?.extracted_information
      if (extracted && typeof extracted === 'object') items.push(extracted as RawItem)
    }
  }
  return items
}

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------

function get(obj: unknown, path: Array<string | number>): unknown {
  let current = obj
  for (const key of path) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string | number, unknown>)[key]
  }
  return current
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
