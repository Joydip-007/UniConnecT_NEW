import { useCallback, useRef, useState } from 'react'
import { useInfiniteQuery, useMutation } from '@tanstack/react-query'
import { Loader2, Search } from 'lucide-react'
import { api } from '@/lib/axios'
import type { KlipyItem, KlipyListResponse, KlipyMedia } from '@uniconnect/shared'
import poweredByKlipy from '@/assets/klipy/powered-by-klipy-white.svg'
import klipyWatermark from '@/assets/klipy/klipy-watermark-light.svg'

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchTrending(media: KlipyMedia, page: number): Promise<KlipyListResponse> {
  const res = await api.get<{ data: KlipyListResponse }>(`/klipy/${media}/trending`, {
    params: { page, per_page: 24 },
  })
  return res.data.data
}

async function fetchSearch(media: KlipyMedia, q: string, page: number): Promise<KlipyListResponse> {
  const res = await api.get<{ data: KlipyListResponse }>(`/klipy/${media}/search`, {
    params: { q, page, per_page: 24 },
  })
  return res.data.data
}

async function postShare(media: KlipyMedia, slug: string): Promise<void> {
  await api.post(`/klipy/${media}/share/${slug}`)
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useKlipyTrending(media: KlipyMedia) {
  return useInfiniteQuery({
    queryKey: ['klipy', media, 'trending'],
    queryFn: ({ pageParam = 1 }) => fetchTrending(media, pageParam as number),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasNext ? last.page + 1 : undefined),
    staleTime: 1000 * 60 * 5,
  })
}

function useKlipySearch(media: KlipyMedia, q: string) {
  return useInfiniteQuery({
    queryKey: ['klipy', media, 'search', q],
    queryFn: ({ pageParam = 1 }) => fetchSearch(media, q, pageParam as number),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasNext ? last.page + 1 : undefined),
    enabled: q.length > 0,
    staleTime: 1000 * 60 * 2,
  })
}

function useKlipyShare() {
  return useMutation({
    mutationFn: ({ media, slug }: { media: KlipyMedia; slug: string }) => postShare(media, slug),
  })
}

// ── StickerDrawer ─────────────────────────────────────────────────────────────

interface StickerDrawerProps {
  onSelect: (url: string) => void
  onClose: () => void
}

const TABS: { label: string; media: KlipyMedia }[] = [
  { label: 'Stickers', media: 'stickers' },
  { label: 'GIFs', media: 'gifs' },
]

export function StickerDrawer({ onSelect, onClose }: StickerDrawerProps) {
  const [activeMedia, setActiveMedia] = useState<KlipyMedia>('stickers')
  const [rawQuery, setRawQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const shareMutation = useKlipyShare()

  const searching = debouncedQuery.length > 0
  const trendingQuery = useKlipyTrending(activeMedia)
  const searchQuery = useKlipySearch(activeMedia, debouncedQuery)

  const activeQuery = searching ? searchQuery : trendingQuery
  const items: KlipyItem[] = (activeQuery.data?.pages ?? []).flatMap((p) => p.items)

  function handleQueryChange(val: string) {
    setRawQuery(val)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => setDebouncedQuery(val.trim()), 300)
  }

  function handleTabChange(media: KlipyMedia) {
    setActiveMedia(media)
    setRawQuery('')
    setDebouncedQuery('')
  }

  const handleSelect = useCallback(
    (item: KlipyItem) => {
      shareMutation.mutate({ media: activeMedia, slug: item.slug })
      onSelect(item.url)
      onClose()
    },
    [activeMedia, shareMutation, onSelect, onClose],
  )

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 80 && activeQuery.hasNextPage && !activeQuery.isFetchingNextPage) {
        activeQuery.fetchNextPage()
      }
    },
    [activeQuery],
  )

  return (
    <div
      style={{
        width: 320,
        maxHeight: 400,
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '0.5px solid var(--border-default)',
          flexShrink: 0,
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.media}
            type="button"
            onClick={() => handleTabChange(tab.media)}
            style={{
              flex: 1,
              padding: '8px 0',
              background: 'none',
              border: 'none',
              borderBottom: activeMedia === tab.media ? '2px solid var(--uc-orange)' : '2px solid transparent',
              color: activeMedia === tab.media ? 'var(--uc-orange)' : 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div
        style={{
          padding: '6px 8px',
          borderBottom: '0.5px solid var(--border-subtle)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Search size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        <input
          type="text"
          value={rawQuery}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Search KLIPY"
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            fontSize: 13,
            color: 'var(--text-primary)',
          }}
        />
      </div>

      {/* Grid */}
      <div
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 8,
          columns: 3,
          columnGap: 6,
        }}
      >
        {activeQuery.isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24, columnSpan: 'all' } as React.CSSProperties}>
            <Loader2 size={20} style={{ color: 'var(--text-tertiary)', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : activeQuery.isError ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)', fontSize: 13 }}>
            Stickers aren't available right now
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)', fontSize: 13 }}>
            No results
          </div>
        ) : (
          <>
            {items.map((item) => (
              <StickerTile key={item.id} item={item} onSelect={handleSelect} />
            ))}
            {activeQuery.isFetchingNextPage && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 8 }}>
                <Loader2 size={16} style={{ color: 'var(--text-tertiary)', animation: 'spin 1s linear infinite' }} />
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* KLIPY attribution — required by API terms */}
      <div
        style={{
          padding: '5px 8px',
          borderTop: '0.5px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <img
          src={poweredByKlipy}
          alt="Powered by KLIPY"
          style={{ height: 14, width: 'auto', opacity: 0.6 }}
        />
      </div>
    </div>
  )
}

// ── StickerTile ───────────────────────────────────────────────────────────────

function StickerTile({ item, onSelect }: { item: KlipyItem; onSelect: (item: KlipyItem) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      title={item.title}
      style={{
        width: '100%',
        breakInside: 'avoid',
        marginBottom: 6,
        background: 'var(--surface-raised)',
        border: '0.5px solid var(--border-subtle)',
        borderRadius: 'var(--r-md)',
        cursor: 'pointer',
        overflow: 'hidden',
        padding: 0,
        display: 'block',
      }}
    >
      <img
        src={item.previewUrl}
        alt={item.title}
        loading="lazy"
        style={{ width: '100%', height: 'auto', display: 'block' }}
      />
    </button>
  )
}

// ── StickerMessage ────────────────────────────────────────────────────────────

export function StickerMessage({ url }: { url: string }) {
  return (
    <div style={{ position: 'relative', width: 160, height: 160, display: 'inline-block' }}>
      <img
        src={url}
        alt="sticker"
        style={{ width: 160, height: 160, objectFit: 'contain', display: 'block' }}
      />
      {/* KLIPY watermark — bottom-left, official light asset, per attribution guidelines */}
      <img
        src={klipyWatermark}
        alt="KLIPY"
        style={{
          position: 'absolute',
          bottom: 6,
          left: 6,
          height: 18,
          width: 'auto',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />
    </div>
  )
}
