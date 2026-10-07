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
      const seen = new Set<string>()
      const message = result.error.issues
        .filter((issue: any) => {
          const key = issue.path.join('.')
          if (seen.has(key)) return false // one message per field is enough
          seen.add(key)
          return true
        })
        .map((issue: any) => `${fieldLabel(issue.path, source)} ${friendlyIssue(issue)}`)
        .join('. ')

      return next(new AppError('validation_error', message, 400))
    }

    req[source] = result.data

    next()
  }
}
function fieldLabel(path: PropertyKey[], source: string): string {
  const last = path.length ? String(path[path.length - 1]) : source
  const words = last.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// Zod's defaults read like type errors ("Too small: expected string to have >=10 characters").
function friendlyIssue(issue: any): string {
  switch (issue.code) {
    case 'invalid_type':
      return issue.input === undefined ? 'is required' : 'has an invalid value'
    case 'too_small':
      if (issue.origin === 'string') return issue.minimum <= 1 ? 'is required' : `must be at least ${issue.minimum} characters`
      return `must be at least ${issue.minimum}`
    case 'too_big':
      if (issue.origin === 'string') return `must be at most ${issue.maximum} characters`
      return `must be at most ${issue.maximum}`
    case 'invalid_format':
      if (issue.format === 'email') return 'must be a valid email address'
      return issue.message && !issue.message.startsWith('Invalid') ? lowerFirst(issue.message) : 'has an invalid format'
    default:
      return issue.message ? lowerFirst(issue.message) : 'is invalid'
  }
}

function lowerFirst(msg: string): string {
  return msg.charAt(0).toLowerCase() + msg.slice(1)
}
