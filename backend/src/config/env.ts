import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { EnvConfig } from '../types/types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../../.env') })
dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

function required(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required env var: ${key}. Check your .env file against .env.example.`)
  }
  return value
}

export const env: EnvConfig = {
  DATABASE_URL: required('DATABASE_URL'),
  REDIS_URL: required('REDIS_URL'),
  JWT_SECRET: required('JWT_SECRET'),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET'),
  HDD_MOUNT_PATH: required('HDD_MOUNT_PATH'),
  PORT: process.env.PORT ? Number(process.env.PORT) : 3000,
  NODE_ENV: (process.env.NODE_ENV as EnvConfig['NODE_ENV']) || 'development',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean)
    : ['http://localhost:5173', 'http://localhost:3000'],
  // MYSQL_ROOT_PASSWORD: required('MYSQL_ROOT_PASSWORD'),
  MYSQL_DATABASE: required('MYSQL_DATABASE'),
  MYSQL_USER: required('MYSQL_USER'),
  MYSQL_PASSWORD: required('MYSQL_PASSWORD'),
  MYSQL_HOST: required('MYSQL_HOST'),
  MYSQL_PORT: Number(process.env.MYSQL_PORT) || 3306,
  APP_URL: process.env.APP_URL || 'http://localhost:5173',
  SMTP_HOST: process.env.SMTP_HOST || 'localhost',
  SMTP_PORT: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 25,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@istrac.local',
}