import { apiClient, extractData } from './client'
import type { Satellite } from './satellites.api'

export interface Department {
  id: string
  satelliteId: string
  name: string
  code?: string | null
  description?: string | null
  hddPath: string
  isActive: boolean
  archived?: boolean
  allowUserFolderCreation: boolean
  maxFolderDepth: number
  satellite?: Satellite
  fileCount?: number
  userCount?: number
  accessLevel?: 'READ_ONLY' | 'READ_WRITE'
  createdAt: string
  updatedAt?: string
}

export interface CreateDepartmentPayload {
  satelliteId?: string
  name: string
  code?: string
  description?: string
  hddPath?: string
  allowUserFolderCreation?: boolean
  maxFolderDepth?: number
}

export interface UpdateDepartmentPayload {
  name?: string
  code?: string
  description?: string
  hddPath?: string
  allowUserFolderCreation?: boolean
  maxFolderDepth?: number
  isActive?: boolean
  archived?: boolean
}

export const departmentsApi = {
  async getPublicDepartments(): Promise<Department[]> {
    const res = await apiClient.get('/departments/public')
    const list = extractData<Department[]>(res)
    return (list || []).map((d) => ({
      ...d,
      archived: !d.isActive,
    }))
  },

  async getPublicDepartment(id: string): Promise<Department> {
    const res = await apiClient.get(`/departments/public/${id}`)
    const d = extractData<Department>(res)
    return { ...d, archived: !d.isActive }
  },

  async getUserDepartments(): Promise<Department[]> {
    const res = await apiClient.get('/departments')
    const list = extractData<Department[]>(res)
    return (list || []).map((d) => ({
      ...d,
      archived: !d.isActive,
    }))
  },

  async getAllAdminDepartments(satelliteId?: string): Promise<Department[]> {
    const res = await apiClient.get('/admin/departments', {
      params: { satelliteId },
    })
    const list = extractData<Department[]>(res)
    return (list || []).map((d) => ({
      ...d,
      archived: !d.isActive,
    }))
  },

  async getDepartment(id: string): Promise<Department> {
    const res = await apiClient.get(`/admin/departments/${id}`)
    const d = extractData<Department>(res)
    return { ...d, archived: !d.isActive }
  },

  async createDepartment(payload: CreateDepartmentPayload): Promise<Department> {
    const res = await apiClient.post('/departments', payload)
    const d = extractData<Department>(res)
    return { ...d, archived: !d.isActive }
  },

  async updateDepartment(id: string, payload: UpdateDepartmentPayload): Promise<Department> {
    const res = await apiClient.put(`/departments/${id}`, payload)
    const d = extractData<Department>(res)
    return { ...d, archived: !d.isActive }
  },

  async deleteDepartment(id: string): Promise<{ message: string }> {
    const res = await apiClient.delete(`/departments/${id}`)
    return extractData<{ message: string }>(res)
  },

  async grantUserAccess(
    deptId: string,
    payload: { userId: string; accessLevel: 'READ_ONLY' | 'READ_WRITE'; expiresAt?: string }
  ): Promise<any> {
    const res = await apiClient.post(`/admin/departments/${deptId}/users`, payload)
    return extractData(res)
  },

  async revokeUserAccess(deptId: string, userId: string): Promise<{ message: string }> {
    const res = await apiClient.delete(`/admin/departments/${deptId}/users/${userId}`)
    return extractData<{ message: string }>(res)
  },
}
