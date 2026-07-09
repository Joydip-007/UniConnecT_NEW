import { vi } from 'vitest'

// Mock database to prevent connection attempts
vi.mock('../config/db', () => ({
  db: {
    migrate: {
      latest: vi.fn().mockResolvedValue(undefined),
    },
    destroy: vi.fn().mockResolvedValue(undefined),
    select: vi.fn().mockReturnValue({ whereIn: vi.fn().mockReturnValue(undefined) }),
    on: vi.fn().mockReturnValue(undefined),
  },
}))

// Mock Redis
vi.mock('../config/redis', () => ({
  redis: {
    quit: vi.fn().mockResolvedValue(undefined),
  },
}))

// Mock Socket.io
vi.mock('../socket', () => ({
  setupSocket: vi.fn(),
  getIo: vi.fn(() => ({})),
}))

// Mock app initialization
vi.mock('../app', () => ({
  createApp: vi.fn(() => ({})),
}))

export {}
