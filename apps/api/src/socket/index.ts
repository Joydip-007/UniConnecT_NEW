import type { Server as HttpServer } from 'node:http'
import { createAdapter } from '@socket.io/redis-adapter'
import type Redis from 'ioredis'
import { Server } from 'socket.io'
import { db } from '../config/db'
import { env } from '../config/env'
import { tokenService } from '../services/token.service'
import { AppError } from '../utils/errors'
import { logger } from '../utils/logger'

let io: Server | null = null

export function setupSocket(httpServer: HttpServer, redisClient: Redis) {
  const pubClient = redisClient.duplicate()
  const subClient = redisClient.duplicate()

  io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      credentials: true,
    },
  })

  io.adapter(createAdapter(pubClient, subClient))
  void connectAdapterClients(pubClient, subClient)

  io.use((socket, next) => {
    const token = socket.handshake.auth.token

    if (typeof token !== 'string' || !token) {
      next(new Error('Unauthorized'))
      return
    }

    const { payload, expired } = tokenService.verifyAccessTokenWithExpiry(token)
    if (!payload) {
      next(new Error(expired ? 'TOKEN_EXPIRED' : 'Unauthorized'))
      return
    }

    socket.data.user = {
      userId: payload.userId,
      universityId: payload.universityId,
      role: payload.role,
    }
    next()
  })

  io.on('connection', (socket) => {
    const user = socket.data.user as { userId: string; universityId: string }
    socket.join(`uni:${user.universityId}`)
    socket.join(`user:${user.userId}`)

    socket.on('typing:start', (payload: unknown) => {
      const convId = getConversationId(payload)
      if (!convId) return
      socket.to(`conv:${convId}`).emit('typing:start', { userId: user.userId, convId })
      socket.to(`conv:${convId}`).emit('conv:typing', { conversationId: convId, userId: user.userId, isTyping: true })
    })

    socket.on('typing:stop', (payload: unknown) => {
      const convId = getConversationId(payload)
      if (!convId) return
      socket.to(`conv:${convId}`).emit('typing:stop', { userId: user.userId, convId })
      socket.to(`conv:${convId}`).emit('conv:typing', { conversationId: convId, userId: user.userId, isTyping: false })
    })

    socket.on('conv:typing:start', (payload: unknown) => {
      const convId = getConversationId(payload)
      if (!convId) return
      socket.to(`conv:${convId}`).emit('conv:typing', { conversationId: convId, userId: user.userId, isTyping: true })
    })

    socket.on('conv:typing:stop', (payload: unknown) => {
      const convId = getConversationId(payload)
      if (!convId) return
      socket.to(`conv:${convId}`).emit('conv:typing', { conversationId: convId, userId: user.userId, isTyping: false })
    })

    socket.on('join:conversation', (convId: unknown) => {
      if (typeof convId !== 'string' || !convId) return
      socket.join(`conv:${convId}`)
    })

    socket.on('conv:join', (payload: unknown) => {
      const convId = getConversationId(payload)
      if (!convId) return
      void db('conversation_participants')
        .where({ conversation_id: convId, user_id: user.userId })
        .first()
        .then((row: unknown) => {
          if (!row) {
            socket.emit('conv:error', { message: 'Not a member' })
            return
          }
          socket.join(`conv:${convId}`)
        })
    })

    socket.on('leave:conversation', (convId: unknown) => {
      if (typeof convId !== 'string' || !convId) return
      socket.leave(`conv:${convId}`)
    })

    socket.on('conv:leave', (payload: unknown) => {
      const convId = getConversationId(payload)
      if (!convId) return
      socket.leave(`conv:${convId}`)
    })

    socket.on('join:university', (payload: unknown) => {
      const universityId = getUniversityId(payload)
      if (!universityId) return
      if (universityId !== user.universityId) return
      socket.join(`uni:${universityId}`)
    })

    socket.on('leave:university', (payload: unknown) => {
      const universityId = getUniversityId(payload)
      if (!universityId) return
      if (universityId !== user.universityId) return
      socket.leave(`uni:${universityId}`)
    })

    logger.info('Socket connected', { socketId: socket.id, userId: user.userId })
  })

  return io
}

export function getIo() {
  if (!io) {
    throw new AppError('Socket server is not initialized', 500, 'SOCKET_NOT_INITIALIZED')
  }

  return io
}

export const initializeSocket = setupSocket
export const getSocketServer = getIo

async function connectAdapterClients(pubClient: Redis, subClient: Redis) {
  try {
    await Promise.all([connectIfWaiting(pubClient), connectIfWaiting(subClient)])
  } catch (error) {
    logger.error('Socket redis adapter connection failed', { error })
  }
}

async function connectIfWaiting(client: Redis) {
  if (client.status === 'wait') {
    await client.connect()
  }
}

function getUniversityId(payload: unknown) {
  if (typeof payload !== 'object' || payload === null) return null
  const uid = (payload as { universityId?: unknown }).universityId
  return typeof uid === 'string' && uid ? uid : null
}

function getConversationId(payload: unknown) {
  if (typeof payload === 'string' && payload) return payload
  if (typeof payload !== 'object' || payload === null) return null
  const convId = (payload as { convId?: unknown; conversationId?: unknown }).convId
    ?? (payload as { conversationId?: unknown }).conversationId
  return typeof convId === 'string' && convId ? convId : null
}
