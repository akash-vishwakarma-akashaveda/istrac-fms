import { apiClient, extractData } from './client'

export interface FileItem {
  id: string
  name: string
  nodeType: 'FILE' | 'FOLDER'
  mimeType?: string | null
  extension?: string | null
  sizeBytes?: string | null
  versionCount: number
  uploader: string
  isFeatured?: boolean
  createdAt: string
  updatedAt: string
}

export interface FileVersion {
  id: string
  versionNum: number
  versionLabel?: string
  isVisible?: boolean
  changeLog?: string | null
  name?: string | null
  mimeType?: string | null
  sizeBytes: string | null
  sha256?: string | null
  uploadedBy: string
  createdAt: string
}

export const filesApi = {
  async uploadSingle(
    file: File,
    departmentId: string,
    parentId?: string | null,
    onProgress?: (percent: number) => void
  ): Promise<any> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('departmentId', departmentId)
    if (parentId) formData.append('parentId', parentId)

    const res = await apiClient.post('/files/upload', formData, {
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(percent)
        }
      },
    })
    return extractData(res)
  },

  async uploadChunk(
    chunkBlob: Blob,
    fileName: string,
    chunkIndex: number,
    totalChunks: number,
    departmentId: string
  ): Promise<any> {
    const formData = new FormData()
    formData.append('chunk', chunkBlob)
    formData.append('fileName', fileName)
    formData.append('chunkIndex', String(chunkIndex))
    formData.append('totalChunks', String(totalChunks))
    formData.append('departmentId', departmentId)

    const res = await apiClient.post('/files/upload/chunk', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return extractData(res)
  },

  async completeChunkUpload(payload: {
    fileName: string
    departmentId: string
    parentId?: string | null
    totalChunks: number
  }): Promise<any> {
    const res = await apiClient.post('/files/upload/complete', payload)
    return extractData(res)
  },

  getDownloadUrl(fileId: string): string {
    const baseUrl = import.meta.env.VITE_API_URL || '/api'
    return `${baseUrl}/files/${fileId}/download`
  },

  async deleteFile(fileId: string): Promise<{ message: string }> {
    const res = await apiClient.delete(`/files/${fileId}`)
    return extractData<{ message: string }>(res)
  },

  async restoreFile(fileId: string): Promise<{ message: string }> {
    const res = await apiClient.put(`/files/${fileId}/restore`)
    return extractData<{ message: string }>(res)
  },

  async getFileVersions(fileId: string): Promise<{ versions: FileVersion[]; file?: any }> {
    const res = await apiClient.get(`/files/${fileId}/versions`)
    const rawList = res.data?.data || []
    return {
      versions: rawList,
      file: res.data?.file || null,
    }
  },

  async uploadNewVersion(
    fileId: string,
    file: File,
    metadata?: {
      versionLabel?: string
      changeLog?: string
      isVisible?: boolean
      title?: string
      description?: string
      spacecraft?: string
      category?: string
    },
    onProgress?: (percent: number) => void
  ): Promise<any> {
    const formData = new FormData()
    formData.append('file', file)
    if (metadata?.versionLabel) formData.append('versionLabel', metadata.versionLabel)
    if (metadata?.changeLog) formData.append('changeLog', metadata.changeLog)
    if (metadata?.isVisible !== undefined) formData.append('isVisible', String(metadata.isVisible))
    if (metadata?.title) formData.append('title', metadata.title)
    if (metadata?.description) formData.append('description', metadata.description)
    if (metadata?.spacecraft) formData.append('spacecraft', metadata.spacecraft)
    if (metadata?.category) formData.append('category', metadata.category)

    const res = await apiClient.post(`/files/${fileId}/version`, formData, {
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(percent)
        }
      },
    })
    return extractData(res)
  },

  async toggleVersionVisibility(fileId: string, versionId: string, isVisible: boolean): Promise<any> {
    const res = await apiClient.patch(`/files/${fileId}/versions/${versionId}/visibility`, { isVisible })
    return extractData(res)
  },

  async createFolder(payload: { name: string; departmentId: string; parentId?: string | null }): Promise<any> {
    const res = await apiClient.post('/files/folders', payload)
    return extractData(res)
  },

  async toggleFeature(fileId: string, isFeatured?: boolean): Promise<{ id: string; isFeatured: boolean; message: string }> {
    const res = await apiClient.patch(`/files/${fileId}/feature`, { isFeatured })
    return extractData<{ id: string; isFeatured: boolean; message: string }>(res)
  },

  async getFeaturedList(departmentId?: string): Promise<any[]> {
    const params = departmentId && departmentId !== 'ALL' ? { departmentId } : {}
    const res = await apiClient.get('/files/featured-list', { params })
    return extractData<any[]>(res)
  },
}
