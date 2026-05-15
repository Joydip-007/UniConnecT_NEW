import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { sendSuccess } from '../../utils/response'
import { unauthorized } from '../../utils/errors'
import { notificationsService } from './service'
import type { NotificationListQuery } from './schema'

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const result = await notificationsService.listNotifications(context.userId, req.query as unknown as NotificationListQuery)
  sendSuccess(res, {
    items: result.items,
    total: result.total,
    page: result.page,
    hasMore: result.page * result.limit < result.total,
    unreadCount: result.unreadCount,
  })
})

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await notificationsService.markRead(context.userId, getNotificationIdParam(req)))
})

export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await notificationsService.markAllRead(context.userId))
})

function getAuthContext(req: Request) {
  if (!req.user) throw unauthorized()
  return req.user
}

function getNotificationIdParam(req: Request) {
  const value = req.params.notificationId
  return Array.isArray(value) ? value[0] : value
}
