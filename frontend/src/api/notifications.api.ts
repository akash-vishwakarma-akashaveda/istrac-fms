import { apiClient, extractData } from './client'

export interface NotificationItem {
  id: string
  type: string
  category: string
  /** Canonical classification computed by the server; use this for filtering. */
  kind?: 'broadcast' | 'event' | 'file' | 'account' | 'system'
  /** Custom category chosen for a broadcast, if any. */
  label?: string | null
  message: string
  readAt?: string | null
  createdAt: string
}

export interface BroadcastCategory {
  id: string
  label: string
}

export const notificationsApi = {
  async getPublicNotifications(): Promise<NotificationItem[]> {
    const res = await apiClient.get('/notifications/public')
    return extractData<NotificationItem[]>(res) || []
  },

  async getNotifications(params: { unread?: boolean; page?: number; limit?: number } = {}): Promise<{
    data: NotificationItem[]
    total: number
    page: number
    limit: number
  }> {
    const res = await apiClient.get('/notifications', { params })
    return res.data
  },

  async getUnreadCount(): Promise<number> {
    const res = await apiClient.get('/notifications/count')
    const data = extractData<{ unread: number }>(res)
    return data.unread
  },

  async markAsRead(id: string): Promise<void> {
    await apiClient.put(`/notifications/${id}/read`)
  },

  async markAllAsRead(): Promise<void> {
    await apiClient.put('/notifications/read-all')
  },

  async dismiss(id: string): Promise<void> {
    await apiClient.delete(`/notifications/${id}`)
  },

  async sendBroadcast(payload: {
    message: string
    type?: string
    label?: string
    target?: string
    departmentIds?: string[]
  }): Promise<{ message: string }> {
    const res = await apiClient.post('/admin/notifications/broadcast', payload)
    return extractData<{ message: string }>(res)
  },

  async revokeBroadcast(id: string): Promise<{ message: string; recipientsAffected: number }> {
    const res = await apiClient.delete(`/admin/notifications/broadcasts/${id}`)
    return extractData<{ message: string; recipientsAffected: number }>(res)
  },

  async getBroadcastCategories(): Promise<BroadcastCategory[]> {
    const res = await apiClient.get('/notifications/broadcast-categories')
    return extractData<BroadcastCategory[]>(res) || []
  },

  async createBroadcastCategory(label: string): Promise<BroadcastCategory[]> {
    const res = await apiClient.post('/admin/notifications/broadcast-categories', { label })
    return extractData<BroadcastCategory[]>(res)
  },

  async deleteBroadcastCategory(id: string): Promise<BroadcastCategory[]> {
    const res = await apiClient.delete(`/admin/notifications/broadcast-categories/${encodeURIComponent(id)}`)
    return extractData<BroadcastCategory[]>(res)
  },
}
