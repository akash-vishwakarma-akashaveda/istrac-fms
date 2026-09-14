import { apiClient, extractData } from './client'

export interface CategoryPreset {
  id: string
  name: string
  code: string
  description?: string | null
  isSystem: boolean
  createdAt?: string
}

export interface NamingPreset {
  id: string
  name: string
  template: string
  description?: string | null
  isDefault: boolean
  createdAt?: string
}

export const reportPresetsApi = {
  async getCategories(): Promise<CategoryPreset[]> {
    const res = await apiClient.get('/report-presets/categories')
    return extractData<CategoryPreset[]>(res)
  },

  async createCategory(payload: { name: string; code: string; description?: string }): Promise<CategoryPreset> {
    const res = await apiClient.post('/report-presets/categories', payload)
    return extractData<CategoryPreset>(res)
  },

  async deleteCategory(id: string): Promise<{ message: string }> {
    const res = await apiClient.delete(`/report-presets/categories/${id}`)
    return extractData<{ message: string }>(res)
  },

  async getNamingPresets(): Promise<NamingPreset[]> {
    const res = await apiClient.get('/report-presets/naming')
    return extractData<NamingPreset[]>(res)
  },

  async createNamingPreset(payload: { name: string; template: string; description?: string }): Promise<NamingPreset> {
    const res = await apiClient.post('/report-presets/naming', payload)
    return extractData<NamingPreset>(res)
  },

  async deleteNamingPreset(id: string): Promise<{ message: string }> {
    const res = await apiClient.delete(`/report-presets/naming/${id}`)
    return extractData<{ message: string }>(res)
  },
}
