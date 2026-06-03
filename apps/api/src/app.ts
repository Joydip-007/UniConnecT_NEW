import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import morgan from 'morgan'
import { env } from './config/env'
import { pingRedis } from './config/redis'
import { adminRouter } from './modules/admin'
import { authRouter } from './modules/auth'
import { eventsRouter } from './modules/events'
import { feedRouter, pollsRouter } from './modules/feed'
import { groupsRouter } from './modules/groups'
import { jobsRouter } from './modules/jobs'
import { messagesRouter } from './modules/messages'
import { newsRouter } from './modules/news'
import { notificationsRouter } from './modules/notifications'
import { campusRouter } from './modules/campus'
import { connectionsRouter } from './modules/connections'
import { contentSyncRouter } from './modules/content-sync'
import { mentorshipRouter } from './modules/mentorship'
import { searchRouter } from './modules/search'
import { exploreRouter } from './modules/explore'
import { uploadRouter } from './modules/upload'
import { usersRouter } from './modules/users'
import { errorHandler } from './middleware/error-handler'
import { asyncHandler } from './utils/asyncHandler'
import { db } from './config/db'

export function createApp() {
  const app = express()

  app.set('trust proxy', 1)

  app.use(helmet())
  const allowedOrigins = env.CLIENT_URL.split(',').map((o) => o.trim())
  app.use(
    cors({
      origin: (origin, cb) => {
        // allow server-to-server requests (no origin) and any listed origin
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
        cb(new Error(`CORS: origin ${origin} not allowed`))
      },
      credentials: true,
    }),
  )
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'))
  app.use(express.json())
  app.use(cookieParser())

  app.get('/', (_req, res) => {
    res.json({ message: 'UniConnecT API is running!' })
  })

  app.get(
    '/health',
    asyncHandler(async (_req, res) => {
      await db.raw('SELECT 1')
      await pingRedis()

      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        db: 'connected',
        redis: 'connected',
      })
    }),
  )

  app.use('/api/v1/admin', adminRouter)
  app.use('/api/v1/admin/content-sync', contentSyncRouter)
  app.use('/api/v1/auth', authRouter)
  app.use('/api/v1/users', usersRouter)
  app.use('/api/v1/upload', uploadRouter)
  app.use('/api/v1/posts', feedRouter)
  app.use('/api/v1/polls', pollsRouter)
  app.use('/api/v1/jobs', jobsRouter)
  app.use('/api/v1/events', eventsRouter)
  app.use('/api/v1/groups', groupsRouter)
  app.use('/api/v1/conversations', messagesRouter)
  app.use('/api/v1/notifications', notificationsRouter)
  app.use('/api/v1/news', newsRouter)
  app.use('/api/v1/connections', connectionsRouter)
  app.use('/api/v1/mentorship', mentorshipRouter)
  app.use('/api/v1/search', searchRouter)
  app.use('/api/v1/explore', exploreRouter)
  app.use('/api/v1', campusRouter)

  // Global error handler. Keep this mounted last.
  app.use(errorHandler)

  return app
}
