import React, { lazy, Suspense, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

const LottiePlayer = lazy(() =>
  import('lottie-react').then((m) => ({ default: m.default })),
)

// ── Manifest types ────────────────────────────────────────────────────────────

interface StickerPack {
  id: string
  name: string
  /** Optional thumbnail shown in the pack strip — falls back to first sticker */
  thumbnail?: string
  stickers: string[]  // filenames relative to the pack folder, e.g. "thumbs-up.json"
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

const BASE = (import.meta.env.VITE_STICKER_BUCKET_URL as string | undefined)?.replace(/\/$/, '') ?? ''

function packUrl(packId: string, filename: string) {
  return `${BASE}/stickers/${packId}/${filename}`
}

function manifestUrl() {
  return `${BASE}/stickers/manifest.json`
}

async function fetchManifest(): Promise<StickerPack[]> {
  if (!BASE) return []
  const res = await fetch(manifestUrl())
  if (!res.ok) return []
  return res.json()
}

async function fetchLottieJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// ── StickerDrawer ─────────────────────────────────────────────────────────────

interface StickerDrawerProps {
  onSelect: (lottieUrl: string) => void
  onClose: () => void
}

export function StickerDrawer({ onSelect, onClose }: StickerDrawerProps) {
  const [activePack, setActivePack] = useState<string | null>(null)

  const { data: packs = [], isLoading } = useQuery({
    queryKey: ['stickers', 'manifest'],
    queryFn: fetchManifest,
    staleTime: 1000 * 60 * 60,
  })

  const currentPack = packs.find((p) => p.id === (activePack ?? packs[0]?.id))

  return (
    <div
      style={{
        width: 320,
        maxHeight: 380,
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
      }}
    >
      {/* Pack strip */}
      {packs.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 4,
            padding: '6px 8px',
            borderBottom: '0.5px solid var(--border-default)',
            overflowX: 'auto',
            flexShrink: 0,
          }}
        >
          {packs.map((pack) => {
            const isActive = (activePack ?? packs[0]?.id) === pack.id
            const thumbUrl = pack.thumbnail
              ? packUrl(pack.id, pack.thumbnail)
              : pack.stickers[0]
                ? packUrl(pack.id, pack.stickers[0])
                : null
            return (
              <button
                key={pack.id}
                type="button"
                onClick={() => setActivePack(pack.id)}
                title={pack.name}
                style={{
                  flexShrink: 0,
                  width: 36,
                  height: 36,
                  borderRadius: 'var(--r-md)',
                  border: isActive
                    ? '1.5px solid var(--uc-indigo)'
                    : '0.5px solid var(--border-subtle)',
                  background: 'var(--surface-raised)',
                  cursor: 'pointer',
                  padding: 2,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {thumbUrl ? (
                  <StickerThumb url={thumbUrl} />
                ) : (
                  <span style={{ fontSize: 18 }}>🎭</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Sticker grid */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 8,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 6,
          alignContent: 'start',
        }}
      >
        {isLoading ? (
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', padding: 24 }}>
            <Loader2 size={20} style={{ color: 'var(--text-tertiary)', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : !BASE ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 24, color: 'var(--text-tertiary)', fontSize: 13 }}>
            Set VITE_STICKER_BUCKET_URL to enable stickers
          </div>
        ) : packs.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 24, color: 'var(--text-tertiary)', fontSize: 13 }}>
            No stickers yet — upload Lottie JSONs to your bucket
          </div>
        ) : (
          currentPack?.stickers.map((filename) => {
            const url = packUrl(currentPack.id, filename)
            return (
              <StickerTile
                key={url}
                url={url}
                onSelect={() => { onSelect(url); onClose() }}
              />
            )
          })
        )}
      </div>
    </div>
  )
}

// ── StickerThumb — static preview shown in the pack strip ────────────────────

function StickerThumb({ url }: { url: string }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null)

  React.useEffect(() => {
    fetchLottieJson(url).then(setData)
  }, [url])

  if (!data) return <span style={{ fontSize: 16 }}>🎭</span>

  return (
    <Suspense fallback={<span style={{ fontSize: 16 }}>🎭</span>}>
      <LottiePlayer animationData={data} loop={false} autoplay={false} style={{ width: 30, height: 30 }} />
    </Suspense>
  )
}

// ── StickerTile — grid cell, plays on hover ──────────────────────────────────

function StickerTile({ url, onSelect }: { url: string; onSelect: () => void }) {
  const [hovered, setHovered] = useState(false)
  const [data, setData] = useState<Record<string, unknown> | null>(null)

  async function handleHover() {
    setHovered(true)
    if (!data) {
      const json = await fetchLottieJson(url)
      if (json) setData(json)
    }
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={handleHover}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        aspectRatio: '1',
        background: 'var(--surface-raised)',
        border: '0.5px solid var(--border-subtle)',
        borderRadius: 'var(--r-md)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        padding: 4,
        transition: 'border-color 150ms',
      }}
    >
      {hovered && data ? (
        <Suspense fallback={<div style={{ width: 72, height: 72 }} />}>
          <LottiePlayer animationData={data} loop autoplay style={{ width: 72, height: 72 }} />
        </Suspense>
      ) : (
        <StaticStickerPreview url={url} />
      )}
    </button>
  )
}

function StaticStickerPreview({ url }: { url: string }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null)

  React.useEffect(() => {
    fetchLottieJson(url).then(setData)
  }, [url])

  if (!data) {
    return (
      <div style={{
        width: 72,
        height: 72,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-tertiary)',
      }}>
        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  return (
    <Suspense fallback={<div style={{ width: 72, height: 72 }} />}>
      <LottiePlayer animationData={data} loop={false} autoplay={false} style={{ width: 72, height: 72 }} />
    </Suspense>
  )
}

// ── StickerMessage — renders a sticker in the chat bubble ────────────────────

export function StickerMessage({ lottieUrl }: { lottieUrl: string }) {
  const [data, setData] = React.useState<Record<string, unknown> | null>(null)

  React.useEffect(() => {
    fetchLottieJson(lottieUrl).then(setData)
  }, [lottieUrl])

  if (!data) return <div style={{ width: 160, height: 160 }} />

  return (
    <Suspense fallback={<div style={{ width: 160, height: 160 }} />}>
      <LottiePlayer animationData={data} loop autoplay style={{ width: 160, height: 160 }} />
    </Suspense>
  )
}
