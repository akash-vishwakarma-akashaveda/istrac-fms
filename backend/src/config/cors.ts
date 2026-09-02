import type { CorsOptions } from 'cors'
import { env } from './env.js'
import { logger } from '../lib/logger.js'

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server, mobile app, postman, and curl requests without an Origin header
    if (!origin) return callback(null, true)

    const normalizedOrigin = origin.trim().replace(/\/+$/, '')

    // 1. Explicitly configured origins or wildcard '*'
    const isExplicitlyAllowed =
      env.ALLOWED_ORIGINS.includes('*') ||
      env.ALLOWED_ORIGINS.some((allowed) => {
        const normAllowed = allowed.trim().replace(/\/+$/, '')
        return normAllowed === normalizedOrigin
      })

    // 2. AWS Amplify Preview & Production URLs (*.amplifyapp.com)
    let isAmplifyApp = false
    try {
      isAmplifyApp = /\.amplifyapp\.com$/i.test(new URL(origin).hostname)
    } catch {}

    // 3. AWS CloudFront Distribution URLs (*.cloudfront.net)
    let isCloudFront = false
    try {
      isCloudFront = /\.cloudfront\.net$/i.test(new URL(origin).hostname)
    } catch {}

    // 4. Localhost development environments
    const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)

    if (isExplicitlyAllowed || isAmplifyApp || isCloudFront || isLocalhost) {
      return callback(null, true)
    }

    logger.warn('CORS', `Blocked unauthorized origin: ${origin}`)
    // Return null, false to reject properly rather than throwing 500
    return callback(null, false)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'x-request-id',
    'x-refresh-token',
    'X-Refresh-Token',
    'Range',
    'x-upload-chunk-index',
    'x-upload-total-chunks',
    'x-upload-id',
    'x-file-name',
    'x-file-size',
    'x-department-id',
    'x-satellite-id',
    'Cache-Control',
    'Pragma',
  ],
  exposedHeaders: [
    'Content-Range',
    'Accept-Ranges',
    'x-request-id',
    'x-refresh-token',
    'X-Refresh-Token',
    'Content-Disposition',
  ],
  maxAge: 86400, // 24h preflight cache
  optionsSuccessStatus: 204,
}