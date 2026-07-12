import { useState, useCallback } from 'react'
import { api } from '@/lib/axios'
import { normalizeImageForUpload } from '@/lib/normalizeImage'

interface PresignResponse {
  uploadUrl: string
  publicUrl: string
}

export function usePresignedUpload(folder: string) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => setError(null), [])

  const upload = useCallback(
    async (file: File): Promise<string> => {
      setUploading(true)
      setError(null)
      try {
        const uploadFile = await normalizeImageForUpload(file)
        const { data } = await api.get<{ data: PresignResponse }>('/upload/presign', {
          params: { filename: uploadFile.name, contentType: uploadFile.type, folder },
        })
        const { uploadUrl, publicUrl } = data.data

        const s3Res = await fetch(uploadUrl, {
          method: 'PUT',
          body: uploadFile,
          headers: { 'Content-Type': uploadFile.type },
        })
        if (!s3Res.ok) throw new Error(`S3 upload failed: ${s3Res.status}`)

        return publicUrl
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed'
        setError(msg)
        throw err
      } finally {
        setUploading(false)
      }
    },
    [folder],
  )

  return { upload, uploading, error, reset }
}
