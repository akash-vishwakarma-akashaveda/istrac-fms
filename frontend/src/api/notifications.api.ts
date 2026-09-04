import { apiClient, extractData } from './client'

export interface NotificationItem {
  id: string
  type: string
  category: string
  message: string
  readAt?: string | null
  createdAt: string
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

  async sendBroadcast(payload: { message: string; type?: string; category?: string }): Promise<{ message: string }> {
    const res = await apiClient.post('/admin/notifications/broadcast', payload)
    return extractData<{ message: string }>(res)
  },
}
