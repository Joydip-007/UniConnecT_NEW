import { describe, it, expect, vi, afterEach } from 'vitest'

afterEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
})

describe('buildPublicUrl', () => {
  it('uses AWS_PUBLIC_URL when set', async () => {
    vi.stubEnv('AWS_PUBLIC_URL', 'https://pub-abc123.r2.dev')
    vi.stubEnv('AWS_S3_BUCKET', 'uniconnect-uploads')
    vi.stubEnv('AWS_REGION', 'auto')
    const { buildPublicUrl } = await import('./upload.service')
    expect(buildPublicUrl('avatars/test-file.jpg')).toBe(
      'https://pub-abc123.r2.dev/avatars/test-file.jpg',
    )
  })

  it('falls back to Amazon URL when AWS_PUBLIC_URL is not set', async () => {
    vi.stubEnv('AWS_PUBLIC_URL', undefined)
    vi.stubEnv('AWS_S3_BUCKET', 'my-bucket')
    vi.stubEnv('AWS_REGION', 'ap-southeast-1')
    const { buildPublicUrl } = await import('./upload.service')
    expect(buildPublicUrl('uploads/foo.png')).toBe(
      'https://my-bucket.s3.ap-southeast-1.amazonaws.com/uploads/foo.png',
    )
  })

  it('URL-encodes special characters in the key', async () => {
    vi.stubEnv('AWS_PUBLIC_URL', 'https://pub-abc123.r2.dev')
    const { buildPublicUrl } = await import('./upload.service')
    expect(buildPublicUrl('uploads/my file (1).jpg')).toBe(
      'https://pub-abc123.r2.dev/uploads/my%20file%20(1).jpg',
    )
  })
})
