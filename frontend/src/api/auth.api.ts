import { apiClient, extractData } from './client'

export interface UserDepartmentAccessItem {
  id?: string
  departmentId?: string
  accessLevel?: 'READ_ONLY' | 'READ_WRITE'
  department?: {
    id: string
    name: string
    code?: string
    satellite?: { code: string }
  }
}

export interface UserProfile {
  id: string
  name: string
  designation?: string | null
  email: string
  employeeId?: string | null
  phone?: string | null
  role: 'ADMIN' | 'MEMBER'
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED'
  departmentPreference?: string | null
  reasonForAccess?: string | null
  lastLogin?: string | null
  createdAt: string
  departmentAccess?: UserDepartmentAccessItem[]
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken?: string
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

export interface Refresh{
  accessToken:string
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

  async refreshToken():Promise<Refresh>{
    const res = await apiClient.post('/auth/refresh')
    return extractData<Refresh>(res)
  }
}
