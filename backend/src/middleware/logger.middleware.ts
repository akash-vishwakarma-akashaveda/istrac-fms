import { Request, Response, NextFunction } from 'express'
import { logger } from '../lib/logger.js'

// ANSI colors for HTTP statuses
const STATUS_COLORS = {
  success: '\x1b[32m\x1b[1m', // Green 2xx
  redirect: '\x1b[36m\x1b[1m', // Cyan 3xx
  clientError: '\x1b[33m\x1b[1m', // Yellow 4xx
  serverError: '\x1b[31m\x1b[1m', // Red 5xx
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
}

function getStatusColor(statusCode: number): string {
  if (statusCode >= 500) return STATUS_COLORS.serverError
  if (statusCode >= 400) return STATUS_COLORS.clientError
  if (statusCode >= 300) return STATUS_COLORS.redirect
  if (statusCode >= 200) return STATUS_COLORS.success
  return STATUS_COLORS.reset
}

export function httpLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = process.hrtime()

  // Hook into response finish event
  res.on('finish', () => {
    // Ignore internal favicon or preflight noise if needed
    if (req.method === 'OPTIONS') return

    const diff = process.hrtime(startTime)
    const durationMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2)

    const statusCode = res.statusCode
    const statusColor = getStatusColor(statusCode)
    const methodStr = `${STATUS_COLORS.bold}${req.method}${STATUS_COLORS.reset}`
    const statusStr = `${statusColor}${statusCode}${STATUS_COLORS.reset}`
    const timeStr = `${STATUS_COLORS.dim}${durationMs}ms${STATUS_COLORS.reset}`
    const urlStr = req.originalUrl || req.url

    // Extract user info if authenticated
    const user = (req as any).user
    const userTag = user
      ? ` - ${STATUS_COLORS.dim}User: ${user.email} (${user.role})${STATUS_COLORS.reset}`
      : ''

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'

    logger.http(
      'HTTP',
      `${methodStr} ${urlStr} ${statusStr} ${timeStr} ${STATUS_COLORS.dim}[${ip}]${STATUS_COLORS.reset}${userTag}`
    )
  })

  next()
}
