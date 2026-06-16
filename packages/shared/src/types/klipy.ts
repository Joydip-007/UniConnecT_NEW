export type KlipyMedia = 'stickers' | 'gifs'

export interface KlipyItem {
  id: string
  slug: string
  title: string
  /** md/webp URL — used when the item is sent */
  url: string
  /** sm/webp URL — used in the picker grid */
  previewUrl: string
  width: number
  height: number
}

export interface KlipyListResponse {
  items: KlipyItem[]
  page: number
  hasNext: boolean
}
