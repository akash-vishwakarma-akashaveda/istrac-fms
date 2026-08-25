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

  async approveUser(id: string): Promise<{ message: string; user: UserProfile }> {
    const res = await apiClient.post(`/users/${id}/approve`)
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

  async updateUser(id: string, payload: { name?: string; employeeId?: string; role?: string }): Promise<UserProfile> {
    const res = await apiClient.put(`/admin/users/${id}`, payload)
    return extractData<UserProfile>(res)
  },

  async forceLogout(id: string): Promise<{ message: string }> {
    const res = await apiClient.post(`/users/${id}/force-logout`)
    return extractData<{ message: string }>(res)
  },
}
