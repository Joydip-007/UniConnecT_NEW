import React, { lazy, Suspense, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

const LottiePlayer = lazy(() =>
  import('lottie-react').then((m) => ({ default: m.default })),
)

interface StickerPack {
  id: string
  name: string
  thumbnailUrl: string
}

interface Sticker {
  id: string
  lottieUrl: string
  thumbnailUrl: string
}

const LOTTIEFILES_API = 'https://lottiefiles.com/api/v1'

async function fetchPacks(): Promise<StickerPack[]> {
  const key = import.meta.env.VITE_LOTTIEFILES_API_KEY as string | undefined
  if (!key) return []
  const res = await fetch(`${LOTTIEFILES_API}/sticker-packs`, {
    headers: { Authorization: `Bearer ${key}` },
  })
  if (!res.ok) return []
  const json = await res.json()
  // LottieFiles returns { data: { sticker_packs: [...] } }
  const packs = json?.data?.sticker_packs ?? json?.data ?? []
  return packs.map((p: Record<string, unknown>) => ({
    id: String(p.id),
    name: String(p.name ?? ''),
    thumbnailUrl: String(p.thumbnail_url ?? p.thumbnailUrl ?? ''),
  }))
}

async function fetchPackStickers(packId: string): Promise<Sticker[]> {
  const key = import.meta.env.VITE_LOTTIEFILES_API_KEY as string | undefined
  if (!key) return []
  const res = await fetch(`${LOTTIEFILES_API}/sticker-packs/${packId}`, {
    headers: { Authorization: `Bearer ${key}` },
  })
  if (!res.ok) return []
  const json = await res.json()
  const stickers = json?.data?.stickers ?? []
  return stickers.map((s: Record<string, unknown>) => ({
    id: String(s.id),
    lottieUrl: String(s.lottie_url ?? s.lottieUrl ?? ''),
    thumbnailUrl: String(s.thumbnail_url ?? s.thumbnailUrl ?? ''),
  }))
}

interface StickerDrawerProps {
  onSelect: (lottieUrl: string) => void
  onClose: () => void
}

export function StickerDrawer({ onSelect, onClose }: StickerDrawerProps) {
  const [activePack, setActivePack] = useState<string | null>(null)

  const { data: packs = [], isLoading: packsLoading } = useQuery({
    queryKey: ['stickers', 'packs'],
    queryFn: fetchPacks,
    staleTime: 1000 * 60 * 60,
  })

  const { data: stickers = [], isLoading: stickersLoading } = useQuery({
    queryKey: ['stickers', 'pack', activePack],
    queryFn: () => fetchPackStickers(activePack!),
    enabled: Boolean(activePack),
    staleTime: 1000 * 60 * 60,
  })

  const currentPackId = activePack ?? packs[0]?.id ?? null

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
          {packs.map((pack) => (
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
                border:
                  (activePack ?? packs[0]?.id) === pack.id
                    ? '1.5px solid var(--uc-indigo)'
                    : '0.5px solid var(--border-subtle)',
                background: 'var(--surface-raised)',
                cursor: 'pointer',
                padding: 2,
                overflow: 'hidden',
              }}
            >
              {pack.thumbnailUrl ? (
                <img src={pack.thumbnailUrl} alt={pack.name} width={32} height={32} style={{ objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: 18 }}>🎭</span>
              )}
            </button>
          ))}
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
        {packsLoading || (stickersLoading && currentPackId) ? (
          <div
            style={{
              gridColumn: '1 / -1',
              display: 'flex',
              justifyContent: 'center',
              padding: 24,
            }}
          >
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-tertiary)' }} />
          </div>
        ) : stickers.length === 0 && !import.meta.env.VITE_LOTTIEFILES_API_KEY ? (
          <div
            style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: 24,
              color: 'var(--text-tertiary)',
              fontSize: 13,
            }}
          >
            Set VITE_LOTTIEFILES_API_KEY to enable stickers
          </div>
        ) : (
          stickers.map((sticker) => (
            <StickerTile
              key={sticker.id}
              sticker={sticker}
              onSelect={() => { onSelect(sticker.lottieUrl); onClose() }}
            />
          ))
        )}
      </div>
    </div>
  )
}

function StickerTile({ sticker, onSelect }: { sticker: Sticker; onSelect: () => void }) {
  const [hovered, setHovered] = useState(false)
  const [lottieData, setLottieData] = useState<Record<string, unknown> | null>(null)
  const [loadError, setLoadError] = useState(false)

  async function handleHover() {
    setHovered(true)
    if (!lottieData && !loadError && sticker.lottieUrl) {
      try {
        const res = await fetch(sticker.lottieUrl)
        if (res.ok) setLottieData(await res.json())
      } catch {
        setLoadError(true)
      }
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
      {hovered && lottieData ? (
        <Suspense fallback={<img src={sticker.thumbnailUrl} alt="sticker" width={72} height={72} style={{ objectFit: 'contain' }} />}>
          <LottiePlayer animationData={lottieData} loop autoplay style={{ width: 72, height: 72 }} />
        </Suspense>
      ) : (
        <img
          src={sticker.thumbnailUrl}
          alt="sticker"
          width={72}
          height={72}
          style={{ objectFit: 'contain' }}
        />
      )}
    </button>
  )
}

/** Renders a sticker message in chat — 160×160 autoplay loop, no bubble */
export function StickerMessage({ lottieUrl }: { lottieUrl: string }) {
  const [data, setData] = React.useState<Record<string, unknown> | null>(null)

  React.useEffect(() => {
    if (!lottieUrl) return
    fetch(lottieUrl)
      .then((r) => r.json())
      .then(setData)
      .catch(() => null)
  }, [lottieUrl])

  if (!data) return <div style={{ width: 160, height: 160 }} />

  return (
    <Suspense fallback={<div style={{ width: 160, height: 160 }} />}>
      <LottiePlayer animationData={data} loop autoplay style={{ width: 160, height: 160 }} />
    </Suspense>
  )
}
