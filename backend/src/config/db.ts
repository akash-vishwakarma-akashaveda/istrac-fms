import { PrismaClient } from '@prisma/client'
import { env } from './env.js'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { logger } from '../lib/logger.js'

const adapter = new PrismaMariaDb({
  host: env.MYSQL_HOST,
  port: env.MYSQL_PORT || 3306,
  user: env.MYSQL_USER,
  password: env.MYSQL_PASSWORD,
  database: env.MYSQL_DATABASE,
  allowPublicKeyRetrieval: true,
} as any)

// Only enable verbose SQL query dumps if DEBUG_PRISMA is explicitly enabled
const shouldLogQueries = process.env.DEBUG_PRISMA === 'true'

export const prisma = new PrismaClient({
  adapter,
  log: shouldLogQueries
    ? [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ]
    : [
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
})

if (shouldLogQueries) {
  ;(prisma as any).$on('query', (e: any) => {
    logger.debug('PRISMA', `${e.query} ${e.params ? `[Params: ${e.params}]` : ''} - \x1b[2m${e.duration}ms\x1b[0m`)
  })
}