import { apiClient, extractData } from './client'
import type { UserProfile } from './auth.api'

export interface UsersQueryParams {
  page?: number
  pageSize?: number
  limit?: number
  search?: string
  status?: string
  role?: string
}

export interface PaginatedUsersResponse {
  data: UserProfile[]
  total: number
  page: number
  limit: number
  pagination: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}

export const usersApi = {
  async getUsers(params: UsersQueryParams = {}): Promise<PaginatedUsersResponse> {
    const res = await apiClient.get('/users', { params })
    return res.data // already contains { data, total, pagination }
  },

  async getPendingUsers(): Promise<UserProfile[]> {
    const res = await apiClient.get('/users/pending')
    return extractData<UserProfile[]>(res)
  },

  async getUser(id: string): Promise<UserProfile> {
    const res = await apiClient.get(`/users/${id}`)
    return extractData<UserProfile>(res)
  },

  async approveUser(
    id: string,
    payload?: {
      role?: string
      employeeId?: string
      departments?: Array<{ departmentId: string; accessLevel?: 'READ_ONLY' | 'READ_WRITE' }>
    },
  ): Promise<{ message: string; user: UserProfile }> {
    const res = await apiClient.post(`/users/${id}/approve`, payload || {})
    return extractData<{ message: string; user: UserProfile }>(res)
  },

  async rejectUser(id: string, reason?: string): Promise<{ message: string; user: UserProfile }> {
    const res = await apiClient.post(`/users/${id}/reject`, { reason })
    return extractData<{ message: string; user: UserProfile }>(res)
  },

  async suspendUser(id: string): Promise<{ message: string; user: UserProfile }> {
    const res = await apiClient.post(`/users/${id}/suspend`)
    return extractData<{ message: string; user: UserProfile }>(res)
  },

  async updateUser(
    id: string,
    payload: {
      name?: string
      designation?: string
      phone?: string
      employeeId?: string
      role?: string
      status?: string
      departments?: Array<{ departmentId: string; accessLevel?: 'READ_ONLY' | 'READ_WRITE' }>
    },
  ): Promise<UserProfile> {
    const res = await apiClient.put(`/admin/users/${id}`, payload)
    return extractData<UserProfile>(res)
  },

  async updateProfile(payload: {
    name?: string
    designation?: string
    phone?: string
  }): Promise<UserProfile> {
    const res = await apiClient.put('/user/profile', payload)
    return extractData<UserProfile>(res)
  },

  async forceLogout(id: string): Promise<{ message: string }> {
    const res = await apiClient.post(`/users/${id}/force-logout`)
    return extractData<{ message: string }>(res)
  },

  async getMissionOverview(): Promise<MissionOverviewData> {
    const res = await apiClient.get('/user/mission-overview')
    return extractData<MissionOverviewData>(res)
  },
}

export interface MissionOverviewData {
  metrics: {
    totalReports: number
    todaysUploads: number
    totalStorageBytes: number
    accessibleDeptsCount: number
    totalDepartments: number
  }
  spacecraftBreakdown: Array<{
    spacecraft: string
    count: number
    color: string
  }>
  categoryBreakdown: Array<{
    category: string
    label: string
    count: number
    percentage: number
    color: string
  }>
  recentFiles: Array<{
    id: string
    name: string
    title: string
    category: string
    version: string
    status: string
    reportDate: string
    author: string
    classification: string
    spacecraft: string
    departmentName: string
    departmentCode: string
    sizeBytes: string
    mimeType: string | null
    extension: string
  }>
  departments: Array<{
    id: string
    name: string
    code: string | null
    description: string | null
    leadOfficer: string
    leadRole: string
    fileCount: number
    accessLevel: string
    isAssigned: boolean
    files: Array<{
      id: string
      name: string
      mimeType: string | null
      extension: string
      sizeBytes: string
      createdAt: string
    }>
  }>
  notices: Array<{
    id: string
    type: string
    category: string
    message: string
    createdAt: string
  }>
}
