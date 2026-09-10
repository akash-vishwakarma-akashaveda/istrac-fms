import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { createServer } from 'node:http'
import { env } from './config/env.js'
import { corsOptions } from './config/cors.js'
import { prisma } from './config/db.js'
import { redis, redisPub, redisSub } from './config/redis.js'

// Middlewares
import { requestIdMiddleware } from './lib/requestId.js'
import { httpLoggerMiddleware } from './middleware/logger.middleware.js'
import { auditMiddleware } from './middleware/audit.middleware.js'
import { globalErrorHandler } from './lib/errors.js'
import { logger } from './lib/logger.js'

// Routes
import { authRouter } from './routes/auth.routes.js'
import { satelliteRouter } from './routes/satellite.routes.js'
import { departmentRouter } from './routes/department.routes.js'
import { userRouter } from './routes/user.routes.js'
import { fileRouter } from './routes/file.routes.js'
import { browseRouter } from './routes/browse.routes.js'
import { notificationRouter } from './routes/notification.routes.js'
import { cmsRouter } from './routes/cms.routes.js'
import { adminRouter } from './routes/admin.routes.js'
import { healthRouter } from './routes/health.routes.js'
import { reportPresetRouter } from './routes/reportPreset.routes.js'
import { eventRouter } from './routes/event.routes.js'

// Services & Daemons
import { startHddHealthService } from './services/hddHealth.service.js'
import { startHddSyncService } from './services/hddSync.service.js'
import { createWsServer } from './ws/wsServer.js'

// Enable JSON.stringify for BigInt across all Prisma models
;import { globalRateLimiter } from './middleware/rateLimiter.middleware.js'
import { schedulerRouter } from './routes/scheduler.routes.js'
(BigInt.prototype as any).toJSON = function () {
  return this.toString()
}

const app = express()
const server = createServer(app)


// F1: HTTP Security Headers
app.use(helmet({
  contentSecurityPolicy: false, // API-only server, CSP not relevant here
  hsts: env.NODE_ENV === 'production'
    ? { maxAge: 63072000, includeSubDomains: true, preload: true }
    : false,
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // required for file streaming to Amplify/CloudFront
  permittedCrossDomainPolicies: false,
  dnsPrefetchControl: { allow: false },
  ieNoOpen: true,
}))

// ============================================================
// CORE MIDDLEWARE PIPELINE
// ============================================================
app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  res.setHeader('Pragma', 'no-cache')
  next()
})
app.use(cors(corsOptions))
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))
app.use(cookieParser())
app.use(requestIdMiddleware)
app.use(httpLoggerMiddleware)
app.use(auditMiddleware)

// ============================================================
// ROUTE REGISTRATION
// ============================================================
app.use('/auth',  authRouter)
app.use(satelliteRouter)
app.use( departmentRouter)
app.use( userRouter)
app.use( fileRouter)
app.use(browseRouter)
app.use(notificationRouter)
app.use(cmsRouter)
app.use(adminRouter)
app.use(reportPresetRouter)
app.use( eventRouter)
app.use( healthRouter)
app.use(schedulerRouter)
app.use(globalRateLimiter) // Apply global rate limiter after all routes to catch any unhandled requests
// ============================================================
// GLOBAL ERROR HANDLER (MUST BE REGISTERED LAST)
// ============================================================
app.use(globalErrorHandler)

// ============================================================
// WEBSOCKET & DAEMONS INITIALIZATION
// ============================================================
createWsServer(server)
startHddHealthService()
startHddSyncService(15) // Reconcile HDD every 15 mins

// ============================================================
// SERVER START & SHUTDOWN
// ============================================================
server.listen(env.PORT, () => {
  logger.info('BOOT', `🛰️  ISTRAC-SIMS Backend active on port \x1b[32m\x1b[1m${env.PORT}\x1b[0m`)
  logger.info('BOOT', `🌐 Environment: \x1b[36m\x1b[1m${env.NODE_ENV}\x1b[0m`)
  logger.info('BOOT', `💾 Storage Mount: \x1b[33m\x1b[1m${env.HDD_MOUNT_PATH}\x1b[0m`)
})

async function shutdown() {
  logger.info('SHUTDOWN', 'Initiating graceful server shutdown...')
  server.close(async () => {
    try {
      await prisma.$disconnect()
      redis.disconnect()
      redisPub.disconnect()
      redisSub.disconnect()
      logger.info('SHUTDOWN', 'All database & Redis connections closed successfully.')
      process.exit(0)
    } catch (err) {
      logger.error('SHUTDOWN', 'Error during shutdown:', err)
      process.exit(1)
    }
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)