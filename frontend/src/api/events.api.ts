import { apiClient, extractData } from './client'

export interface MissionEventItem {
  id: string
  title: string
  description?: string | null
  eventType: 'MISSION_PASS' | 'LAUNCH' | 'ORBIT_MANEUVER' | 'MAINTENANCE' | 'SEMINAR' | 'ANOMALY'
  satelliteId?: string | null
  satellite?: { id: string; name: string; code?: string | null } | null
  departmentId?: string | null
  department?: { id: string; name: string; code?: string | null } | null
  eventDate: string
  endDate?: string | null
  location?: string | null
  urgency: 'NORMAL' | 'IMPORTANT' | 'CRITICAL'
  status: 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  showOnBanner: boolean
  createdAt: string
  updatedAt: string
}

export interface ActiveBannerData {
  events: MissionEventItem[]
  broadcasts: Array<{
    id: string
    message: string
    createdAt: string
    metadata?: any
  }>
}

export const eventsApi = {
  async getEvents(params?: {
    status?: string
    type?: string
    departmentId?: string
    satelliteId?: string
    limit?: number
  }): Promise<MissionEventItem[]> {
    const res = await apiClient.get('/events', { params })
    return extractData(res)
  },

  async getActiveBanner(): Promise<ActiveBannerData> {
    const res = await apiClient.get('/events/active-banner')
    return extractData(res)
  },

  async createEvent(data: Partial<MissionEventItem>): Promise<MissionEventItem> {
    const res = await apiClient.post('/events', data)
    return extractData(res)
  },

  async updateEvent(id: string, data: Partial<MissionEventItem>): Promise<MissionEventItem> {
    const res = await apiClient.put(`/events/${id}`, data)
    return extractData(res)
  },

  async deleteEvent(id: string): Promise<{ id: string; deleted: boolean }> {
    const res = await apiClient.delete(`/events/${id}`)
    return extractData(res)
  },
}
