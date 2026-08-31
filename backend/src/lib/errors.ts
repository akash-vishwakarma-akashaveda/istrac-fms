import type { Request, Response, NextFunction } from 'express'
import { env } from '../config/env.js'
import { logger } from './logger.js'
import * as crypto from 'node:crypto'
import { securityMonitorService } from '../services/securityMonitor.service.js'
// ============================================================
// APP ERROR CLASS
// ============================================================

/**
 * Operational error thrown by application code.
 * Distinguishable from programmer errors by `isOperational = true`.
 */
export class AppError extends Error {
  readonly code: string
  readonly statusCode: number
  readonly details?: unknown
  readonly isOperational = true

  constructor(code: string, message: string, statusCode = 500, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
    this.details = details

    // Restore prototype chain
    Object.setPrototypeOf(this, new.target.prototype)

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

// ============================================================
// PRISMA ERROR SHAPE
// ============================================================

interface PrismaKnownError {
  code: string
  constructor: { name: string }
}

function isPrismaKnownError(err: unknown): err is PrismaKnownError {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { constructor?: { name?: string } }).constructor?.name === 'PrismaClientKnownRequestError' &&
    typeof (err as PrismaKnownError).code === 'string'
  )
}

// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================

/**
 * Express 4-argument error-handling middleware.
 * Must be registered LAST in the middleware chain.
 */
export function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const requestId = req.requestId ?? 'unknown'
  const internalRequestId = crypto.randomUUID()
  const isDev = env.NODE_ENV === 'development'

  // ----------------------------------------------------------
  // 1. Operational AppError
  // ----------------------------------------------------------
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error('APP_ERROR', `[InternalReq: ${internalRequestId}] ${err.code}: ${err.message}`, err.stack)
    } else {
      logger.warn('APP_WARN', `[InternalReq: ${internalRequestId}] ${err.code}: ${err.message}`)
    }

    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined && { details: err.details }),
      },
      requestId,
    })
    return
  }

  // ----------------------------------------------------------
  // 2. Prisma known request errors
  // ----------------------------------------------------------
  if (isPrismaKnownError(err)) {
    logger.error('DATABASE_ERROR', `[InternalReq: ${internalRequestId}] Prisma Code: ${err.code}`, err)

    if (err.code === 'P2002') {
      res.status(409).json({
        error: { code: 'conflict', message: 'Resource already exists' },
        requestId,
      })
      return
    }

    if (err.code === 'P2025') {
      res.status(404).json({
        error: { code: 'not_found', message: 'Resource not found' },
        requestId,
      })
      return
    }

    res.status(500).json({
      error: { code: 'database_error', message: 'Database query failed' },
      requestId,
    })
    return
  }

  // ----------------------------------------------------------
  // 3. Unknown / programmer errors
  // ----------------------------------------------------------
  logger.error('UNHANDLED_EXCEPTION', `[InternalReq: ${internalRequestId}]`, err)

  if (isDev) {
    const message = err instanceof Error ? err.message : String(err)

    res.status(500).json({
      error: {
        code: 'internal_error',
        message,
    
      },
      requestId,
    })
    return
  }


  if (
  err instanceof AppError &&
  (err.statusCode === 401 || err.statusCode === 403)
) {
    void securityMonitorService.recordAuthFailure(req.ip!)
}
 

  // Production — never leak internals
  res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'An unexpected error occurred',
    },
    requestId,
  })
}
