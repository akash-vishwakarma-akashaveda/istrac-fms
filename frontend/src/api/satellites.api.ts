import { apiClient, extractData } from './client'

export interface Satellite {
  id: string
  name: string
  code?: string | null
  description?: string | null
  isActive: boolean
  departmentCount?: number
  createdAt: string
  updatedAt?: string
}

export interface CreateSatellitePayload {
  name: string
  code?: string
  description?: string
}

export interface UpdateSatellitePayload {
  name?: string
  code?: string
  description?: string
  isActive?: boolean
}

export const satellitesApi = {
  async getActiveSatellites(): Promise<Satellite[]> {
    const res = await apiClient.get('/satellites')
    return extractData<Satellite[]>(res)
  },

  async getAllAdminSatellites(): Promise<Satellite[]> {
    const res = await apiClient.get('/admin/satellites')
    return extractData<Satellite[]>(res)
  },

  async getSatellite(id: string): Promise<Satellite> {
    const res = await apiClient.get(`/admin/satellites/${id}`)
    return extractData<Satellite>(res)
  },

  async createSatellite(payload: CreateSatellitePayload): Promise<Satellite> {
    const res = await apiClient.post('/admin/satellites', payload)
    return extractData<Satellite>(res)
  },

  async updateSatellite(id: string, payload: UpdateSatellitePayload): Promise<Satellite> {
    const res = await apiClient.put(`/admin/satellites/${id}`, payload)
    return extractData<Satellite>(res)
  },

  async deleteSatellite(id: string): Promise<{ message: string }> {
    const res = await apiClient.delete(`/admin/satellites/${id}`)
    return extractData<{ message: string }>(res)
  },
}
