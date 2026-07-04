import { ZodError } from 'zod'
import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../utils/errors'
import { logger } from '../utils/logger'
import { env } from '../config/env'

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code })
    return
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      error: 'Request validation failed',
      code: 'VALIDATION_ERROR',
      issues: err.format(),
    })
    return
  }

  logger.error('Unhandled API error', {
    err,
    request: {
      method: req.method,
      path: req.originalUrl,
      origin: req.get('origin') ?? null,
      universityDomain: req.get('x-university-domain') ?? null,
      ip: req.ip,
    },
  })

  const body: { error: string; code: string; stack?: string } = {
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  }

  if (env.NODE_ENV !== 'production' && err instanceof Error) {
    body.stack = err.stack
  }

  res.status(500).json(body)
}
