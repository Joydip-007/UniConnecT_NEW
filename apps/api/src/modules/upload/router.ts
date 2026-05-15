import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { validateRequest } from '../../middleware/validate'
import { presignUpload } from './controller'
import { PresignUploadQuerySchema } from './schema'

export const uploadRouter = Router()

uploadRouter.use(requireAuth, resolveUniversity)
uploadRouter.get('/presign', validateRequest({ query: PresignUploadQuerySchema }), presignUpload)
