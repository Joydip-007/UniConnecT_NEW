import type { Request, Response } from 'express'
import { unauthorized } from '../../utils/errors'
import { asyncHandler } from '../../utils/asyncHandler'
import { getPresignedUploadUrl, sanitizeFileName } from '../../services/upload.service'
import { sendSuccess } from '../../utils/response'
import type { PresignUploadQuery } from './schema'

export const presignUpload = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user || !req.university) throw unauthorized()

  const query = req.query as unknown as PresignUploadQuery
  const key = `uploads/${req.university.id}/${req.user.userId}/${Date.now()}-${sanitizeFileName(query.filename)}`
  sendSuccess(res, await getPresignedUploadUrl(key, query.contentType))
})
