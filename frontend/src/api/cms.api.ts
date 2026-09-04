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
}
