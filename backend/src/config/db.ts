import { PrismaClient } from '@prisma/client'
import { env } from './env.js'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

const adapter = new PrismaMariaDb({
  host: env.MYSQL_HOST,
  port: env.MYSQL_PORT || 3306,
  user: env.MYSQL_USER,
  password: env.MYSQL_PASSWORD,
  database: env.MYSQL_DATABASE,
  allowPublicKeyRetrieval: true,
} as any)

export const prisma = new PrismaClient({
  adapter,
  log: env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
})