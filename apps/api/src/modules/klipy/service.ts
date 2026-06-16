import type { KlipyItem, KlipyListResponse, KlipyMedia } from '@uniconnect/shared'
import { env } from '../../config/env'
import { serviceUnavailable, tooManyRequests } from '../../utils/errors'

const KLIPY_BASE = 'https://api.klipy.com/api/v1'

function getKey(): string {
  if (!env.KLIPY_API_KEY) throw serviceUnavailable('Stickers are not configured')
  return env.KLIPY_API_KEY
}

interface RawKlipyFile {
  url: string
  width: number
  height: number
  size: number
}

interface RawKlipyItem {
  id: string
  slug: string
  title: string
  file: Record<string, Record<string, RawKlipyFile>>
}

interface RawKlipyResponse {
  data: {
    data: RawKlipyItem[]
    pagination?: { next_page?: number | null }
    current_page?: number
    next_page?: number | null
  }
}

function normalizeItem(raw: RawKlipyItem): KlipyItem {
  const md = raw.file?.md
  const sm = raw.file?.sm
  const url = md?.webp?.url ?? md?.gif?.url ?? sm?.webp?.url ?? sm?.gif?.url ?? ''
  const previewUrl = sm?.webp?.url ?? sm?.gif?.url ?? url
  const width = md?.webp?.width ?? md?.gif?.width ?? 0
  const height = md?.webp?.height ?? md?.gif?.height ?? 0
  return { id: raw.id, slug: raw.slug, title: raw.title, url, previewUrl, width, height }
}

async function klipyFetch(path: string, params: Record<string, string>): Promise<Response> {
  const url = new URL(`${KLIPY_BASE}/${getKey()}${path}`)
  url.searchParams.set('content_filter', env.KLIPY_CONTENT_FILTER)
  url.searchParams.set('locale', 'en')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  const res = await fetch(url.toString())

  if (res.status === 429) throw tooManyRequests()
  if (!res.ok) throw serviceUnavailable('Sticker service unavailable')
  return res
}

export async function getTrending(
  media: KlipyMedia,
  page: number,
  perPage: number,
  customerId: string,
): Promise<KlipyListResponse> {
  const res = await klipyFetch(`/${media}/trending`, {
    page: String(page),
    per_page: String(perPage),
    customer_id: customerId,
  })
  const body = (await res.json()) as unknown as RawKlipyResponse
  const items = (body.data?.data ?? []).map(normalizeItem)
  const nextPage = body.data?.pagination?.next_page ?? body.data?.next_page
  return { items, page, hasNext: Boolean(nextPage) }
}

export async function search(
  media: KlipyMedia,
  q: string,
  page: number,
  perPage: number,
  customerId: string,
): Promise<KlipyListResponse> {
  const res = await klipyFetch(`/${media}/search`, {
    q,
    page: String(page),
    per_page: String(perPage),
    customer_id: customerId,
  })
  const body = (await res.json()) as unknown as RawKlipyResponse
  const items = (body.data?.data ?? []).map(normalizeItem)
  const nextPage = body.data?.pagination?.next_page ?? body.data?.next_page
  return { items, page, hasNext: Boolean(nextPage) }
}

export async function getCategories(media: KlipyMedia, customerId: string): Promise<unknown> {
  const res = await klipyFetch(`/${media}/categories`, { customer_id: customerId })
  const body = (await res.json()) as unknown as { data: unknown }
  return body.data
}

export async function recordShare(
  media: KlipyMedia,
  slug: string,
  customerId: string,
): Promise<void> {
  try {
    await klipyFetch(`/${media}/share/${slug}`, { customer_id: customerId })
  } catch {
    // Share is a best-effort engagement signal — never let it propagate
  }
}
