import { apiClient, extractData } from './client'

export const cmsApi = {
  async getBlocks(): Promise<Record<string, unknown>> {
    const res = await apiClient.get('/cms/blocks')
    return extractData<Record<string, unknown>>(res)
  },

  async getBlock(blockKey: string): Promise<unknown> {
    const res = await apiClient.get(`/cms/blocks/${blockKey}`)
    return extractData<unknown>(res)
  },

  async updateBlock(blockKey: string, content: unknown): Promise<any> {
    const res = await apiClient.put(`/cms/blocks/${blockKey}`, { content })
    return extractData(res)
  },

  async uploadAsset(file: File): Promise<{ url: string; filename: string; size: number }> {
    const formData = new FormData()
    formData.append('file', file)
    const res = await apiClient.post('/cms/upload-asset', formData)
    return extractData(res)
  },
}
