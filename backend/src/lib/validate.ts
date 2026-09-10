import type { Request, Response, NextFunction } from 'express'
import type { ZodType } from 'zod'
import { AppError } from './errors.js'

type ValidationSource = 'body' | 'query' | 'params'

export function validate(
  schema: ZodType,
  source: ValidationSource = 'body',
) {
  return (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): void => {
    const result = schema.safeParse(req[source])

    if (!result.success) {
      const message = result.error.issues
        .map((issue: any) => {
          const path = issue.path.length
            ? issue.path.join('.')
            : source

          return `${path}: ${issue.message}`
        })
        .join('; ')

      return next(
        new AppError(
          'validation_error',
          message,
          400,
        ),
      )
    }

 
    req[source] = result.data

    next()
  }
}