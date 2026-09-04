import { apiClient, extractData } from './client'

export interface SatelliteDepartment {
  id: string
  name: string
  code?: string | null
  pageTitle?: string | null
  pageLeadOfficer?: string | null
  pageLeadRole?: string | null
  pageContact?: string | null
}

export interface Satellite {
  id: string
  satId?: string | null
  name: string
  code?: string | null
  description?: string | null
  launchDate?: string | null
  payloads?: string | null
  fuelBalance?: string | null
  launchMass?: string | null
  orbitType?: string | null
  status?: string | null
  isActive: boolean
  departmentCount?: number
  departments?: SatelliteDepartment[]
  recentEvents?: Array<{
    id: string
    title: string
    eventType: string
    eventDate: string
    urgency?: string
    status?: string
  }>
  createdAt: string
  updatedAt?: string
}

export interface CreateSatellitePayload {
  satId?: string
  name: string
  code?: string
  description?: string
  launchDate?: string | null
  payloads?: string
  fuelBalance?: string
  launchMass?: string
  orbitType?: string
  status?: string
  departmentIds?: string[]
}

export interface UpdateSatellitePayload {
  satId?: string
  name?: string
  code?: string
  description?: string
  launchDate?: string | null
  payloads?: string
  fuelBalance?: string
  launchMass?: string
  orbitType?: string
  status?: string
  isActive?: boolean
  departmentIds?: string[]
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

  async getPublicSatellite(id: string): Promise<Satellite> {
    const res = await apiClient.get(`/satellites/${id}`)
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

