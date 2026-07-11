import { describe, it, expect, afterEach } from 'vitest'
import { env } from '../config/env'
import { buildPublicUrl } from './upload.service'

const originalEnv = {
  AWS_PUBLIC_URL: env.AWS_PUBLIC_URL,
  AWS_S3_BUCKET: env.AWS_S3_BUCKET,
  AWS_REGION: env.AWS_REGION
}

afterEach(() => {
  env.AWS_PUBLIC_URL = originalEnv.AWS_PUBLIC_URL
  env.AWS_S3_BUCKET = originalEnv.AWS_S3_BUCKET
  env.AWS_REGION = originalEnv.AWS_REGION
})

describe('buildPublicUrl', () => {
  it('uses AWS_PUBLIC_URL when set', () => {
    env.AWS_PUBLIC_URL = 'https://pub-abc123.r2.dev'
    env.AWS_S3_BUCKET = 'uniconnect-uploads'
    env.AWS_REGION = 'auto'
    
    expect(buildPublicUrl('avatars/test-file.jpg')).toBe(
      'https://pub-abc123.r2.dev/avatars/test-file.jpg',
    )
  })

  it('falls back to Amazon URL when AWS_PUBLIC_URL is not set', () => {
    env.AWS_PUBLIC_URL = undefined
    env.AWS_S3_BUCKET = 'my-bucket'
    env.AWS_REGION = 'ap-southeast-1'
    
    expect(buildPublicUrl('uploads/foo.png')).toBe(
      'https://my-bucket.s3.ap-southeast-1.amazonaws.com/uploads/foo.png',
    )
  })

  it('URL-encodes special characters in the key', () => {
    env.AWS_PUBLIC_URL = 'https://pub-abc123.r2.dev'
    env.AWS_S3_BUCKET = 'uniconnect-uploads'
    env.AWS_REGION = 'auto'
    
    expect(buildPublicUrl('uploads/my file (1).jpg')).toBe(
      'https://pub-abc123.r2.dev/uploads/my%20file%20(1).jpg',
    )
  })

  it('strips trailing slash from AWS_PUBLIC_URL', () => {
    env.AWS_PUBLIC_URL = 'https://pub-abc123.r2.dev/'
    env.AWS_S3_BUCKET = 'uniconnect-uploads'
    env.AWS_REGION = 'auto'
    
    expect(buildPublicUrl('uploads/photo.jpg')).toBe(
      'https://pub-abc123.r2.dev/uploads/photo.jpg',
    )
  })
})
