import type { AuthContext } from './auth'

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext
      user?: AuthContext
      university?: {
        id: string
        name: string
        domain: string
        plan: string
        allowedEmailDomains: string[]
      }
    }
  }
}

export {}
