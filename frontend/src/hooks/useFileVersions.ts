import { useQuery } from '@tanstack/react-query'
import { filesApi, type FileVersion } from '../api'

export type { FileVersion }

export interface FileMetadata {
  id: string
  name: string
  title?: string
  description?: string
  extension?: string
  mimeType?: string
  sizeBytes?: number | string
  sha256?: string
  createdAt?: string
  uploaderName?: string
  uploaderEmail?: string
  departmentId?: string
  departmentName?: string
  departmentCode?: string
  spacecraft?: string
  category?: string
  classificationLevel?: string
  versionCount?: number
}

export function useFileVersions(fileId: string | null) {
  return useQuery({
    queryKey: ['file-versions', fileId],
    queryFn: async () => {
      if (!fileId) return { versions: [], file: null }
      const res = await filesApi.getFileVersions(fileId)
      const versions = (res.versions || []).map((v) => ({
        id: v.id,
        versionNum: v.versionNum,
        versionLabel: v.versionLabel || `V${v.versionNum}.0`,
        isVisible: v.isVisible !== undefined ? Boolean(v.isVisible) : true,
        changeLog: v.changeLog || null,
        name: v.name || null,
        mimeType: v.mimeType || null,
        sizeBytes: v.sizeBytes ? Number(v.sizeBytes) : null,
        sha256: v.sha256 || null,
        uploadedBy: v.uploadedBy,
        uploaderName: v.uploadedBy,
        uploaderEmail: (v as any).uploaderEmail,
        createdAt: v.createdAt,
      }))
      return { versions, file: (res.file as FileMetadata) || null }
    },
    enabled: !!fileId,
  })
}