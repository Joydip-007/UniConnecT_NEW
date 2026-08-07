import type { NextFunction, Request, Response } from 'express'
import type { ZodSchema, ZodType } from 'zod'
import { validationError } from '../utils/errors'

interface ValidationSchemas {
  body?: ZodType
  params?: ZodType
  query?: ZodType
}

// A request sent with no body at all (e.g. `api.post(url)`) leaves `req.body`
// undefined, since express.json() only runs on a JSON content-type. Treat that as
// an empty object so all-optional schemas pass and required ones report the
// missing fields instead of an opaque "expected object, received undefined".
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body ?? {})

    if (!result.success) {
      next(validationError(result.error.issues))
      return
    }

    req.body = result.data
    next()
  }
}

export function validateBody(schema: ZodSchema) {
  return validate(schema)
}

export function validateRequest(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (schemas.body) {
      const result = schemas.body.safeParse(req.body ?? {})
      if (!result.success) {
        next(validationError(result.error.issues))
        return
      }
      req.body = result.data
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params)
      if (!result.success) {
        next(validationError(result.error.issues))
        return
      }
      req.params = result.data as Request['params']
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query)
      if (!result.success) {
        next(validationError(result.error.issues))
        return
      }
      // Express 5 makes req.query a read-only getter on the prototype;
      // define an own property to shadow it with the parsed value.
      Object.defineProperty(req, 'query', {
        value: result.data,
        writable: true,
        configurable: true,
        enumerable: true,
      })
    }

    next()
  }
}
