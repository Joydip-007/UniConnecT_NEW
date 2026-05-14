import type { z } from 'zod'

export class AppError extends Error {
  public readonly isOperational = true

  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function notFound(message = 'Not found', code = 'NOT_FOUND') {
  return new AppError(message, 404, code)
}

export function unauthorized(message = 'Unauthorized', code = 'AUTH_REQUIRED') {
  return new AppError(message, 401, code)
}

export function forbidden(message = 'Forbidden', code = 'FORBIDDEN') {
  return new AppError(message, 403, code)
}

export function badRequest(message = 'Bad request', code = 'BAD_REQUEST') {
  return new AppError(message, 400, code)
}

export function conflict(message = 'Conflict', code = 'CONFLICT') {
  return new AppError(message, 409, code)
}

export function tooManyRequests(message = 'Too many requests', code = 'RATE_LIMITED') {
  return new AppError(message, 429, code)
}

export function validationError(issues: z.ZodIssue[]) {
  return new AppError(JSON.stringify(issues), 422, 'VALIDATION_ERROR')
}
