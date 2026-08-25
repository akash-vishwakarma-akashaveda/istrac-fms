import { apiClient, extractData } from './client'

export interface UserProfile {
  id: string
  name: string
  email: string
  employeeId?: string | null
  role: 'ADMIN' | 'MEMBER' | 'SUPER_ADMIN' | 'DEPT_ADMIN' | 'GUEST'
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED'
  departmentPreference?: string | null
  reasonForAccess?: string | null
  lastLogin?: string | null
  createdAt: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  user: UserProfile
}

export interface RegisterRequest {
  name: string
  email: string
  employeeId?: string
  password: string
}

export interface RegisterResponse {
  message: string
  user: UserProfile
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export const authApi = {
  async login(payload: LoginRequest): Promise<LoginResponse> {
    const res = await apiClient.post('/auth/login', payload)
    return extractData<LoginResponse>(res)
  },

  async register(payload: RegisterRequest): Promise<RegisterResponse> {
    const res = await apiClient.post('/auth/register', payload)
    return extractData<RegisterResponse>(res)
  },

  async getMe(): Promise<UserProfile> {
    const res = await apiClient.get('/auth/me')
    return extractData<UserProfile>(res)
  },

  async logout(): Promise<{ message: string }> {
    const res = await apiClient.post('/auth/logout')
    return extractData<{ message: string }>(res)
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    const res = await apiClient.post('/auth/forgot-password', { email })
    return extractData<{ message: string }>(res)
  },

  async resetPassword(payload: { token: string; newPassword: string }): Promise<{ message: string }> {
    const res = await apiClient.post('/auth/reset-password', payload)
    return extractData<{ message: string }>(res)
  },

  async changePassword(payload: ChangePasswordRequest): Promise<{ message: string }> {
    const res = await apiClient.put('/auth/change-password', payload)
    return extractData<{ message: string }>(res)
  },
}
