import { apiClient, extractData } from './client'
import type { FileItem } from './files.api'

export interface TreeNode {
  id: string
  name: string
  parentId: string | null
  children: TreeNode[]
}

export interface SearchResultItem {
  id: string
  name: string
  nodeType: string
  mimeType?: string | null
  extension?: string | null
  sizeBytes?: string | null
  departmentId: string
  departmentName: string
  departmentCode?: string
  satelliteId?: string | null
  satelliteName: string
  satelliteCode?: string | null
  hddPath: string
  reportTitle?: string | null
  reportAuthor?: string | null
  reportCategory?: string | null
  customCategory?: string | null
  classificationLevel?: string | null
  versionLabel?: string | null
  createdAt: string
  updatedAt: string
}

export interface SearchFilters {
  q?: string
  departmentId?: string
  satelliteId?: string
  category?: string
  extension?: string
  classificationLevel?: string
  startDate?: string
  endDate?: string
  sortBy?: 'updatedAt' | 'createdAt' | 'name' | 'sizeBytes'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface BrowseFilesParams {
  parentId?: string | null
  type?: 'FILE' | 'FOLDER'
  page?: number
  limit?: number
}

export interface BrowseFilesResponse {
  data: FileItem[]
  total: number
  page: number
  limit: number
}

export const browseApi = {
  async getDepartmentFiles(deptId: string, params: BrowseFilesParams = {}): Promise<BrowseFilesResponse> {
    const res = await apiClient.get(`/departments/${deptId}/files`, { params })
    return res.data // { data, total, page, limit }
  },

  async getDepartmentTree(deptId: string): Promise<TreeNode[]> {
    const res = await apiClient.get(`/departments/${deptId}/tree`)
    return extractData<TreeNode[]>(res)
  },

  async search(params: string | SearchFilters, departmentId?: string, page = 1, limit = 20): Promise<{
    data: SearchResultItem[]
    total: number
    page: number
    limit: number
  }> {
    const queryParams = typeof params === 'string'
      ? { q: params, departmentId, page, limit }
      : { ...params }

    const res = await apiClient.get('/search', {
      params: queryParams,
    })
    return res.data
  },
}
