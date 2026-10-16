import { apiClient, extractData } from './client'

export interface AdminStats {
  users: number
  files: number
  departments: number
  satellites?: number
  pendingUsers?: number
  storageUsedBytes: number
  recentFiles?: Array<{
    id: string
    name: string
    extension: string
    sizeBytes: string
    sha256?: string
    department?: { id: string; name: string; code?: string }
    report?: { id: string; title: string; spacecraft?: string; category?: string }
    updatedAt: string
  }>
  recentLogs?: Array<{
    id: number
    userName: string
    action: string
    resourceType?: string
    resourceId?: string
    createdAt: string
  }>
}

export interface AuditLogEntry {
  id: number
  userId: string | null
  userName?: string
  action: string
  resourceType: string | null
  resourceId: string | null
  oldValue: Record<string, unknown> | null
  newValue: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: string
}

export interface AuditLogPage {
  data: AuditLogEntry[]
  nextCursor: string | null
}

export interface AuditLogQueryParams {
  action?: string
  userId?: string
  dateFrom?: string
  dateTo?: string
  cursor?: string
  pageSize?: number
}

export interface SystemConfig {
  maxUploadSizeBytes: number
  allowedExtensions: string[]
  virusScanEnabled: boolean
  guestAccessExpiryDays: number
  hddSyncIntervalMinutes: number
  downloadRateLimitPerHour: number
  [key: string]: unknown
}

export interface SmtpConfigData {
  enabled: boolean
  host: string
  port: number
  securityMode: 'STARTTLS' | 'SSL' | 'PLAIN'
  allowSelfSigned: boolean
  user: string
  pass?: string
  hasPassword?: boolean
  fromEmail: string
  fromName: string
  adminAlertEmail: string
  notifyUserApproval: boolean
  notifyPasswordReset: boolean
  notifyStorageHealth: boolean
  notifyBroadcasts: boolean
  notifyDocumentRequests: boolean
}

export interface SmtpTestResult {
  success: boolean
  message: string
}

export const adminApi = {
  async getStats(): Promise<AdminStats> {
    const res = await apiClient.get('/admin/stats')
    return extractData<AdminStats>(res)
  },

  async getAuditLogs(params: AuditLogQueryParams = {}): Promise<AuditLogPage> {
    const res = await apiClient.get('/admin/audit-logs', { params })
    return res.data // { data: [...], nextCursor }
  },

  async getSystemConfig(): Promise<SystemConfig> {
    const res = await apiClient.get('/admin/settings')
    return extractData<SystemConfig>(res)
  },

  async updateSetting(key: string, value: unknown): Promise<{ key: string; value: unknown }> {
    const res = await apiClient.put(`/admin/settings/${key}`, { value })
    return extractData<{ key: string; value: unknown }>(res)
  },

  async getSmtpConfig(): Promise<SmtpConfigData> {
    const res = await apiClient.get('/admin/smtp')
    return extractData<SmtpConfigData>(res)
  },

  async updateSmtpConfig(config: Partial<SmtpConfigData>): Promise<SmtpConfigData> {
    const res = await apiClient.put('/admin/smtp', config)
    return extractData<SmtpConfigData>(res)
  },

  async testSmtpConnection(data: { config?: Partial<SmtpConfigData>; testEmail?: string }): Promise<SmtpTestResult> {
    const res = await apiClient.post('/admin/smtp/test', data)
    return extractData<SmtpTestResult>(res)
  },
}

