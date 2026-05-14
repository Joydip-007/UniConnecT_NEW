import { createServer } from 'node:http'
import { createApp } from './app'
import { db } from './config/db'
import { redis } from './config/redis'
import { env } from './config/env'
import { setupSocket } from './socket'
import { logger } from './utils/logger'
import './workers'

const app = createApp()
const httpServer = createServer(app)

setupSocket(httpServer, redis)

httpServer.listen(env.PORT, () => {
  logger.info('API listening', { port: env.PORT })
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    httpServer.close(() => {
      void Promise.allSettled([db.destroy(), redis.quit()]).finally(() => process.exit(0))
    })
  })
}
