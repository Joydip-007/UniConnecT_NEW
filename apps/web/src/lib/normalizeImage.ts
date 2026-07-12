const MAX_DIMENSION = 2000
const JPEG_QUALITY = 0.85
const NORMALIZABLE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/**
 * Downscales oversized images and re-encodes them as JPEG before upload — keeps large
 * phone-camera/screenshot files from bloating storage and slowing the feed, while
 * leaving already-reasonable images and non-image files (PDFs, docs, GIFs) untouched.
 */
export async function normalizeImageForUpload(file: File): Promise<File> {
  if (!NORMALIZABLE_TYPES.has(file.type)) return file

  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const withinBudget = scale === 1 && file.type === 'image/jpeg' && file.size <= 2 * 1024 * 1024
  if (withinBudget) {
    bitmap.close()
    return file
  }

  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return file
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  )
  if (!blob || blob.size >= file.size) return file

  const newName = file.name.replace(/\.\w+$/, '') + '.jpg'
  return new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() })
}
