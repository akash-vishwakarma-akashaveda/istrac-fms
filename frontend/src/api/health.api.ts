import { apiClient } from './client'

export interface HealthStatus {
  status: 'ok' | 'degraded'
  db: 'ok' | 'error'
  redis: 'ok' | 'error'
  hdd: 'ok' | 'error'
  timestamp: string
}

export interface HddHealthReport {
  mounted: boolean
  mountPath: string
  isDegraded: boolean
  lastChecked: string
}

export const healthApi = {
  async getHealth(): Promise<HealthStatus> {
    const res = await apiClient.get<HealthStatus>('/health')
    return res.data
  },

  async getAdminHddHealth(): Promise<HddHealthReport> {
    const res = await apiClient.get('/admin/health/hdd')
    return res.data?.data || res.data
  },
}
