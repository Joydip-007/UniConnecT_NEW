import type { Response } from 'express'

export interface ApiSuccess<T> {
  data: T
}

export interface ApiFailure {
  error: string
  code: string
}

export interface PaginatedData<T> {
  items: T[]
  total: number
  page: number
  hasMore: boolean
}

export function sendSuccess<T>(res: Response, data: T, statusCode = 200) {
  return res.status(statusCode).json({ data } satisfies ApiSuccess<T>)
}

export function sendPaginated<T>(res: Response, items: T[], total: number, page: number, limit: number) {
  return res.json({
    data: {
      items,
      total,
      page,
      hasMore: page * limit < total,
    },
  } satisfies ApiSuccess<PaginatedData<T>>)
}

export function sendFailure(res: Response, error: string, code: string, statusCode: number) {
  return res.status(statusCode).json({ error, code } satisfies ApiFailure)
}
