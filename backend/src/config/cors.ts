import type { CorsOptions } from 'cors'
import { env } from './env.js'
import { logger } from '../lib/logger.js'

// ============================================================
// STRICT TRUSTED ORIGIN WHITELIST
// Multi-tenant wildcards (*.amplifyapp.com, *.cloudfront.net)
// are strictly forbidden with credentials: true to prevent
// cross-tenant account takeover and token theft.
// ============================================================
const TRUSTED_PRODUCTION_ORIGINS = [
  'https://protov1.dlkt5x6pmnb2e.amplifyapp.com', // Official ISTRAC Amplify Frontend
  'https://d2qycovk79gx2n.cloudfront.net',         // ISTRAC CloudFront Gateway
  'http://localhost:5173',                          // Local Vite development
  'http://localhost:3000',                          // Local development server
]

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (server-to-server, curl, mobile, daemons) without an Origin header
    if (!origin) return callback(null, true)

    const normalizedOrigin = origin.trim().replace(/\/+$/, '')

    // 1. Exact match against trusted production origins
    if (TRUSTED_PRODUCTION_ORIGINS.includes(normalizedOrigin)) {
      return callback(null, true)
    }

    // 2. Explicitly configured custom origins from .env (e.g., https://fms.istrac.gov.in)
    const isEnvAllowed = env.ALLOWED_ORIGINS.some((allowed) => {
      const normAllowed = allowed.trim().replace(/\/+$/, '')
      return normAllowed !== '*' && normAllowed === normalizedOrigin
    })

    if (isEnvAllowed) {
      return callback(null, true)
    }

    // 3. Localhost in development mode only
    if (env.NODE_ENV === 'development') {
      const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizedOrigin)
      if (isLocalhost) return callback(null, true)
    }

    logger.warn('CORS', `Blocked unauthorized origin: ${origin}`)
    // Return null, false to reject properly rather than throwing an unhandled 500
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