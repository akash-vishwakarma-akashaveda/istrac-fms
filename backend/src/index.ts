import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { createServer } from 'node:http'
import { env } from './config/env.js'
import { corsOptions } from './config/cors.js'
import { prisma } from './config/db.js'
import { redis, redisPub, redisSub } from './config/redis.js'

// Middlewares
import { requestIdMiddleware } from './lib/requestId.js'
import { auditMiddleware } from './middleware/audit.middleware.js'
import { globalErrorHandler } from './lib/errors.js'

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

// Services & Daemons
import { startHddHealthService } from './services/hddHealth.service.js'
import { startHddSyncService } from './services/hddSync.service.js'
import { createWsServer } from './ws/wsServer.js'

const app = express()
const server = createServer(app)

// ============================================================
// CORE MIDDLEWARE PIPELINE
// ============================================================
app.use(cors(corsOptions))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))
app.use(cookieParser())
app.use(requestIdMiddleware)
app.use(auditMiddleware)

// ============================================================
// ROUTE REGISTRATION
// ============================================================
app.use('/auth', authRouter)
app.use(satelliteRouter)
app.use(departmentRouter)
app.use(userRouter)
app.use(fileRouter)
app.use(browseRouter)
app.use(notificationRouter)
app.use(cmsRouter)
app.use(adminRouter)
app.use(reportPresetRouter)
app.use(healthRouter)

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
  console.log(`[ISTRAC-FMS] Backend active on port ${env.PORT}`)
  console.log(`[ISTRAC-FMS] Environment: ${env.NODE_ENV}`)
  console.log(`[ISTRAC-FMS] Storage Mount: ${env.HDD_MOUNT_PATH}`)
})

async function shutdown() {
  console.log('[ISTRAC-FMS] Initiating graceful shutdown...')
  server.close(async () => {
    try {
      await prisma.$disconnect()
      redis.disconnect()
      redisPub.disconnect()
      redisSub.disconnect()
      console.log('[ISTRAC-FMS] All connections closed successfully.')
      process.exit(0)
    } catch (err) {
      console.error('[ISTRAC-FMS] Error during shutdown:', err)
      process.exit(1)
    }
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)