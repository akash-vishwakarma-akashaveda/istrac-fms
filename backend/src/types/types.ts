export interface EnvConfig {
  DATABASE_URL: string
  REDIS_URL: string
  JWT_SECRET: string
  JWT_REFRESH_SECRET: string
  HDD_MOUNT_PATH: string
  PORT: number
  NODE_ENV: 'development' | 'production' | 'test'
  ALLOWED_ORIGINS: string[]
  MYSQL_DATABASE: string
  MYSQL_USER: string
  MYSQL_PASSWORD: string
  MYSQL_HOST: string
  MYSQL_PORT: number
  APP_URL?: string
  SMTP_HOST?: string
  SMTP_PORT?: number
  SMTP_USER?: string
  SMTP_PASS?: string
  ADMIN_EMAIL?: string
}

export interface SmtpConfig {
  enabled: boolean
  host: string
  port: number
  securityMode: 'STARTTLS' | 'SSL' | 'PLAIN'
  allowSelfSigned: boolean
  user: string
  pass?: string
  fromEmail: string
  fromName: string
  adminAlertEmail: string
  notifyUserApproval: boolean
  notifyPasswordReset: boolean
  notifyStorageHealth: boolean
  notifyBroadcasts: boolean
  notifyDocumentRequests: boolean
}