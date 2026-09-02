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
  createdAt: string
  updatedAt: string
}

export interface FileVersion {
  id: string
  versionNum: number
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

  async getFileVersions(fileId: string): Promise<FileVersion[]> {
    const res = await apiClient.get(`/files/${fileId}/versions`)
    return extractData<FileVersion[]>(res)
  },

  async createFolder(payload: { name: string; departmentId: string; parentId?: string | null }): Promise<any> {
    const res = await apiClient.post('/files/folders', payload)
    return extractData(res)
  },
}
