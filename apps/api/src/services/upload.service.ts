import { randomUUID } from 'node:crypto'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from '../config/env'

export const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials:
    env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
  ...(env.AWS_ENDPOINT && {
    endpoint: env.AWS_ENDPOINT,   // https://<accountid>.r2.cloudflarestorage.com
    forcePathStyle: false,        // R2 uses virtual-hosted-style (default for R2)
  }),
})

export interface CreateUploadCommandInput {
  fileName: string
  contentType: string
  folder?: string
}

export interface PresignedUpload {
  uploadUrl: string
  publicUrl: string
}

export function createUploadKey(input: CreateUploadCommandInput) {
  const safeFileName = sanitizeFileName(input.fileName)
  const folder = input.folder?.replace(/^\/+|\/+$/g, '') || 'uploads'
  return `${folder}/${randomUUID()}-${safeFileName}`
}

export function createPutObjectCommand(input: CreateUploadCommandInput) {
  const key = createUploadKey(input)

  return {
    key,
    command: new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: key,
      ContentType: input.contentType,
    }),
  }
}

export async function getPresignedUploadUrl(key: string, contentType: string): Promise<PresignedUpload> {
  const command = new PutObjectCommand({
    Bucket: env.AWS_S3_BUCKET,
    Key: key,
    ContentType: contentType,
  })

  return {
    uploadUrl: await getSignedUrl(s3Client, command, { expiresIn: 300 }),
    publicUrl: buildPublicUrl(key),
  }
}

/** Returns the public CDN URL for a stored object key. */
export function buildPublicUrl(key: string): string {
  if (env.AWS_PUBLIC_URL) {
    return `${env.AWS_PUBLIC_URL.replace(/\/$/, '')}/${encodeS3Key(key)}`
  }
  return `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${encodeS3Key(key)}`
}

/** Base prefix every publicUrl returned by this service starts with — used to validate client-supplied URLs actually point at our own bucket. */
export function getPublicUrlPrefix(): string {
  return env.AWS_PUBLIC_URL
    ? `${env.AWS_PUBLIC_URL.replace(/\/$/, '')}/`
    : `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/`
}

export const uploadService = {
  getPresignedUploadUrl,
}

export function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '-')
}

function encodeS3Key(key: string) {
  return key.split('/').map(encodeURIComponent).join('/')
}
